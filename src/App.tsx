import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { checkBackendHealth, simplify } from "./api/simplify";
import {
  type FunctionName,
  type FunctionSlot,
  type ParamName,
  type ValidationError,
  getNextFunctionName,
  validateWorkbench,
} from "./lib/validation";

type SlotKind = FunctionSlot["kind"];
type HealthState = "checking" | "up" | "down";
type ParamOption = {
  label: string;
  value: ParamName[];
};

type Example = {
  id: string;
  label: string;
  expression: string;
  slots: FunctionSlot[];
};

const examples: Example[] = [
  {
    id: "basic",
    label: "基础",
    expression: "x+x",
    slots: [],
  },
  {
    id: "normal",
    label: "普通函数",
    expression: "f(x,2)",
    slots: [{ id: "example-normal-f", name: "f", kind: "normal", params: ["x", "y"], body: "x+y" }],
  },
  {
    id: "recursive",
    label: "递推",
    expression: "f{3}(x)",
    slots: [
      {
        id: "example-recursive-f",
        name: "f",
        kind: "recursive",
        params: ["x"],
        base0: "x",
        base1: "x^2",
        recurrence: "f{n-1}(x)+f{n-2}(x)",
      },
    ],
  },
  {
    id: "multi",
    label: "多形参",
    expression: "f{2}(x,2)",
    slots: [
      {
        id: "example-multi-f",
        name: "f",
        kind: "recursive",
        params: ["x", "y"],
        base0: "x+y",
        base1: "x*y",
        recurrence: "f{n-1}(x,y)+f{n-2}(x,y)",
      },
    ],
  },
  {
    id: "derivative",
    label: "求导",
    expression: "dx(x^2+sin(x))",
    slots: [],
  },
];

const paramOptions: ParamOption[] = [
  { label: "x", value: ["x"] },
  { label: "x,y", value: ["x", "y"] },
  { label: "x,y,z", value: ["x", "y", "z"] },
];

function makeId(name: FunctionName, kind: SlotKind): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${kind}-${name}-${random}`;
}

function createSlot(name: FunctionName, kind: SlotKind): FunctionSlot {
  if (kind === "normal") {
    return {
      id: makeId(name, kind),
      name,
      kind,
      params: ["x"],
      body: "",
    };
  }

  return {
    id: makeId(name, kind),
    name,
    kind,
    params: ["x"],
    base0: "",
    base1: "",
    recurrence: "",
  };
}

function cloneSlots(slots: FunctionSlot[]): FunctionSlot[] {
  return slots.map((slot) => ({ ...slot, params: [...slot.params] }));
}

function formatParams(params: ParamName[]): string {
  return params.join(",");
}

function sameParams(left: ParamName[], right: ParamName[]): boolean {
  return left.length === right.length && left.every((param, index) => param === right[index]);
}

function errorMessages(errors: ValidationError[], slotId?: string, fieldPrefix?: string): string[] {
  return errors
    .filter((error) => {
      if (slotId && error.slotId !== slotId) {
        return false;
      }
      if (fieldPrefix && !error.field.startsWith(fieldPrefix)) {
        return false;
      }
      return true;
    })
    .map((error) => error.message);
}

export default function App() {
  const [slots, setSlots] = useState<FunctionSlot[]>([]);
  const [expression, setExpression] = useState("x+x");
  const [pendingKind, setPendingKind] = useState<SlotKind>("normal");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [result, setResult] = useState("");
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<HealthState>("checking");

  const nextName = useMemo(() => getNextFunctionName(slots), [slots]);
  const atLimit = !nextName;
  const expressionErrors = errorMessages(errors, undefined, "expression");

  useEffect(() => {
    let isMounted = true;

    checkBackendHealth().then((isUp) => {
      if (isMounted) {
        setHealth(isUp ? "up" : "down");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function addSlot() {
    if (!nextName) {
      return;
    }

    setSlots((current) => [...current, createSlot(nextName, pendingKind)]);
    setErrors([]);
  }

  function removeSlot(id: string) {
    setSlots((current) => current.filter((slot) => slot.id !== id));
    setErrors((current) => current.filter((error) => error.slotId !== id));
  }

  function updateSlot(id: string, patch: Partial<FunctionSlot>) {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? ({ ...slot, ...patch } as FunctionSlot) : slot)),
    );
  }

  function applyExample(example: Example) {
    setSlots(cloneSlots(example.slots));
    setExpression(example.expression);
    setErrors([]);
    setResult("");
    setApiError("");
    setCopied(false);
  }

  function resetAll() {
    setSlots([]);
    setExpression("x+x");
    setErrors([]);
    setResult("");
    setApiError("");
    setCopied(false);
  }

  async function runSimplify() {
    const validation = validateWorkbench(slots, expression);
    setResult("");
    setApiError("");
    setCopied(false);

    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setIsLoading(true);

    try {
      const response = await simplify(validation.request);
      setResult(response.result);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "请求失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Formula Bench</p>
          <h1>公式化简工作台</h1>
          <p className="project-note">这个项目源于 samlee1020 的课程学习，功能较弱仅供娱乐。</p>
          <div className="repo-links" aria-label="项目仓库链接">
            <a
              href="https://github.com/samlee1020/java-formula-simplifier-frontend"
              target="_blank"
              rel="noreferrer"
            >
              前端仓库
            </a>
            <a
              href="https://github.com/samlee1020/java-formula-simplifier-service"
              target="_blank"
              rel="noreferrer"
            >
              后端仓库
            </a>
          </div>
        </div>
        <div className={`health-cluster health-${health}`}>
          <div className="health-pill">
            {health === "checking" ? <LoaderCircle className="spin" size={16} /> : <Activity size={16} />}
            <span>{health === "checking" ? "正在唤醒后端" : health === "up" ? "后端在线" : "后端离线"}</span>
          </div>
          {health === "checking" && (
            <p>Render Free 实例初次访问可能冷启动，请等待几分钟后再运行。</p>
          )}
          {health === "down" && <p>后端暂时不可用，可以稍后刷新重试。</p>}
        </div>
      </header>

      <main className="workspace">
        <section className="panel functions-panel" aria-labelledby="functions-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">f / g / h</p>
              <h2 id="functions-title">自定义函数</h2>
            </div>
            <span className="slot-meter">{slots.length}/3</span>
          </div>

          <div className="add-rack">
            <div className="segmented" aria-label="函数类型">
              <button
                className={pendingKind === "normal" ? "active" : ""}
                type="button"
                onClick={() => setPendingKind("normal")}
              >
                普通
              </button>
              <button
                className={pendingKind === "recursive" ? "active" : ""}
                type="button"
                onClick={() => setPendingKind("recursive")}
              >
                递推
              </button>
            </div>
            <button
              className="icon-command"
              type="button"
              onClick={addSlot}
              disabled={atLimit}
              title={atLimit ? "已达到 f/g/h 数量上限" : "添加自定义函数"}
              aria-label={atLimit ? "已达到 f/g/h 数量上限" : "添加自定义函数"}
            >
              <Plus size={18} />
            </button>
          </div>

          {atLimit && <p className="limit-note">已达到 f/g/h 数量上限</p>}

          <div className="slot-stack">
            {slots.length === 0 ? (
              <div className="empty-state">
                <span className="empty-orbit">f</span>
                <span className="empty-orbit">g</span>
                <span className="empty-orbit">h</span>
              </div>
            ) : (
              slots.map((slot) => {
                const slotErrors = errorMessages(errors, slot.id);

                return (
                  <article className="function-card" key={slot.id}>
                    <div className="function-card-head">
                      <div className="slot-badge">{slot.name}</div>
                      <div>
                        <h3>{slot.kind === "normal" ? "普通函数" : "递推函数"}</h3>
                        <p>{slot.kind === "normal" ? `${slot.name}(...)` : `${slot.name}{0} / {1} / {n}`}</p>
                      </div>
                      <button
                        className="ghost-icon"
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        title="删除函数"
                        aria-label="删除函数"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="param-control">
                      <span>参数</span>
                      <div className="param-options" role="group" aria-label={`${slot.name} 参数列表`}>
                        {paramOptions.map((option) => (
                          <button
                            className={sameParams(slot.params, option.value) ? "active" : ""}
                            key={option.label}
                            type="button"
                            onClick={() => updateSlot(slot.id, { params: option.value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {slot.kind === "normal" ? (
                      <label className="signature-field">
                        <span className="signature-label">{slot.name}({formatParams(slot.params)}) =</span>
                        <input
                          value={slot.body}
                          onChange={(event) => updateSlot(slot.id, { body: event.target.value })}
                          placeholder="x+y"
                          spellCheck={false}
                        />
                      </label>
                    ) : (
                      <div className="recurrence-grid">
                        <label className="signature-field">
                          <span className="signature-label">{slot.name}{"{0}"}({formatParams(slot.params)}) =</span>
                          <input
                            value={slot.base0}
                            onChange={(event) => updateSlot(slot.id, { base0: event.target.value })}
                            placeholder="x"
                            spellCheck={false}
                          />
                        </label>
                        <label className="signature-field">
                          <span className="signature-label">{slot.name}{"{1}"}({formatParams(slot.params)}) =</span>
                          <input
                            value={slot.base1}
                            onChange={(event) => updateSlot(slot.id, { base1: event.target.value })}
                            placeholder="x^2"
                            spellCheck={false}
                          />
                        </label>
                        <label className="signature-field">
                          <span className="signature-label">{slot.name}{"{n}"}({formatParams(slot.params)}) =</span>
                          <input
                            value={slot.recurrence}
                            onChange={(event) => updateSlot(slot.id, { recurrence: event.target.value })}
                            placeholder={`${slot.name}{n-1}(x)+${slot.name}{n-2}(x)`}
                            spellCheck={false}
                          />
                        </label>
                      </div>
                    )}

                    {slotErrors.length > 0 && (
                      <div className="inline-errors">
                        {slotErrors.map((message) => (
                          <p key={message}>{message}</p>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel expression-panel" aria-labelledby="expression-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">input</p>
              <h2 id="expression-title">目标表达式</h2>
            </div>
            <button className="text-command" type="button" onClick={resetAll}>
              <RotateCcw size={16} />
              重置
            </button>
          </div>

          <label className="expression-box">
            <textarea
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="dx(x^2+sin(x))"
              spellCheck={false}
            />
          </label>

          {expressionErrors.length > 0 && (
            <div className="inline-errors expression-errors">
              {expressionErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <div className="hint-strip">
            <span>显式乘号</span>
            <code>2*x</code>
            <span>复杂实参</span>
            <code>f((x+1),2)</code>
          </div>

          <div className="grammar-reference">
            <ul className="grammar-notes">
              <li>支持整数、加减乘 <code>+</code><code>-</code><code>*</code>、整数次幂 <code>^</code>、括号 <code>()</code>、<code>sin</code>、<code>cos</code> 和求导 <code>dx(...)</code>。</li>
              <li>目标表达式只允许自由变量 <code>x</code>，而 <code>y</code>、<code>z</code> 只用于函数参数。</li>
              <li>乘法必须显式写 <code>*</code>，例如 <code>2*x</code>。</li>
              <li><code>sin</code>、<code>cos</code> 内部是因子：写 <code>sin((x+1))</code>，不要写 <code>sin(x+1)</code>。</li>
              <li>函数实参也是因子：写 <code>f((x+1),2)</code>，不要写 <code>f(x+1,2)</code>。</li>
            </ul>

            <details className="grammar-details">
              <summary>
                <span>展开输入文法</span>
                <span>EBNF</span>
              </summary>

              <div className="grammar-grid">
                <section>
                  <h3>表达式文法</h3>
                  <pre>{`FunctionName  ::= "f" | "g" | "h"
Param         ::= "x" | "y" | "z"
ParamList     ::= Param | Param "," ParamList

Integer       ::= "0" | NonZeroDigit Digit*
Variable      ::= "x" | "y" | "z"

Expr          ::= Sum
Sum           ::= Product (("+" | "-") Product)*
Product       ::= Power ("*" Power)*
Power         ::= Factor ("^" Integer)?

Factor        ::= Integer
                | Variable
                | "(" Expr ")"
                | "sin(" Factor ")"
                | "cos(" Factor ")"
                | "dx(" Expr ")"
                | NormalCall
                | RecursiveCall

NormalCall    ::= FunctionName "(" ArgList? ")"
RecursiveCall ::= FunctionName "{" Integer "}" "(" ArgList? ")"
ArgList       ::= Factor | Factor "," ArgList`}</pre>
                </section>

                <section>
                  <h3>函数定义</h3>
                  <pre>{`NormalFunction    ::= FunctionName "(" ParamList ")" "=" Expr

RecursiveFunction ::= FunctionName "{0}" "(" ParamList ")" "=" Expr
                    + FunctionName "{1}" "(" ParamList ")" "=" Expr
                    + FunctionName "{n}" "(" ParamList ")" "=" Expr

RecursiveRef      ::= FunctionName "{" ("n-1" | "n-2") "}" "(" ArgList? ")"`}</pre>
                </section>
              </div>
            </details>
          </div>

          <div className="examples">
            {examples.map((example) => (
              <button key={example.id} type="button" onClick={() => applyExample(example)}>
                {example.label}
              </button>
            ))}
          </div>

          <button className="run-button" type="button" onClick={runSimplify} disabled={isLoading}>
            {isLoading ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}
            {isLoading ? "计算中" : "运行化简"}
          </button>
        </section>

        <aside className="panel result-panel" aria-labelledby="result-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">output</p>
              <h2 id="result-title">结果</h2>
            </div>
            <button
              className="ghost-icon"
              type="button"
              onClick={copyResult}
              disabled={!result}
              title="复制结果"
              aria-label="复制结果"
            >
              <Copy size={17} />
            </button>
          </div>

          <div className={`result-readout ${result ? "has-result" : ""} ${apiError ? "has-error" : ""}`}>
            {isLoading ? (
              <div className="readout-state">
                <LoaderCircle className="spin" size={22} />
                <span>后端部署在 Render Free 计划上，初次访问可能正在冷启动</span>
              </div>
            ) : result ? (
              <>
                <div className="readout-label">
                  <CheckCircle2 size={18} />
                  <span>{copied ? "已复制" : "化简完成"}</span>
                </div>
                <pre className="result-value">{result}</pre>
              </>
            ) : apiError ? (
              <div className="readout-state error">
                <AlertCircle size={22} />
                <span>{apiError}</span>
              </div>
            ) : (
              <div className="readout-state muted">
                <span>结果将在这里显示</span>
              </div>
            )}
          </div>

          <div className="request-shape">
            <span>发送结构</span>
            <code>normalFunctions[]</code>
            <code>recursiveFunctions[][]</code>
            <code>expression</code>
          </div>
        </aside>
      </main>
    </div>
  );
}
