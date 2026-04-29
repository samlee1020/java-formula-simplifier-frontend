import type { SimplifyRequest } from "../api/simplify";

export const FUNCTION_NAMES = ["f", "g", "h"] as const;
export const PARAM_NAMES = ["x", "y", "z"] as const;

export type FunctionName = (typeof FUNCTION_NAMES)[number];
export type ParamName = (typeof PARAM_NAMES)[number];

export type NormalFunctionSlot = {
  id: string;
  name: FunctionName;
  kind: "normal";
  params: ParamName[];
  body: string;
};

export type RecursiveFunctionSlot = {
  id: string;
  name: FunctionName;
  kind: "recursive";
  params: ParamName[];
  base0: string;
  base1: string;
  recurrence: string;
};

export type FunctionSlot = NormalFunctionSlot | RecursiveFunctionSlot;

export type ValidationError = {
  field: string;
  message: string;
  slotId?: string;
};

export type ValidationResult =
  | { ok: true; request: SimplifyRequest; errors: [] }
  | { ok: false; errors: ValidationError[] };

const MAX_EXPRESSION_LENGTH = 10_000;
const MAX_FUNCTION_LINE_LENGTH = 5_000;
const MAX_FUNCTIONS = 3;

export function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

export function getNextFunctionName(slots: FunctionSlot[]): FunctionName | undefined {
  const used = new Set(slots.map((slot) => slot.name));
  return FUNCTION_NAMES.find((name) => !used.has(name));
}

export function normalizeParams(params: ParamName[]): string | undefined {
  if (params.length < 1 || params.length > PARAM_NAMES.length) {
    return undefined;
  }

  if (new Set(params).size !== params.length) {
    return undefined;
  }

  if (!params.every((param) => PARAM_NAMES.includes(param))) {
    return undefined;
  }

  return params.join(",");
}

function validateFunctionLine(
  value: string,
  field: string,
  label: string,
  errors: ValidationError[],
  slotId?: string,
): string {
  const trimmed = value.trim();
  const compactValue = compact(value);

  if (!compactValue) {
    errors.push({ field, slotId, message: `${label}不能为空` });
  } else if (compactValue.length > MAX_FUNCTION_LINE_LENGTH) {
    errors.push({ field, slotId, message: `${label}不能超过 ${MAX_FUNCTION_LINE_LENGTH} 个字符` });
  }

  return trimmed;
}

export function validateWorkbench(slots: FunctionSlot[], expression: string): ValidationResult {
  const errors: ValidationError[] = [];
  const compactExpression = compact(expression);

  if (!compactExpression) {
    errors.push({ field: "expression", message: "目标表达式不能为空" });
  } else if (compactExpression.length > MAX_EXPRESSION_LENGTH) {
    errors.push({ field: "expression", message: `目标表达式不能超过 ${MAX_EXPRESSION_LENGTH} 个字符` });
  }

  if (/[yz]/.test(compactExpression)) {
    errors.push({ field: "expression", message: "目标表达式只允许自由变量 x" });
  }

  if (slots.length > MAX_FUNCTIONS) {
    errors.push({ field: "functions", message: "自定义函数最多只能添加 f/g/h 三个" });
  }

  const names = new Set<FunctionName>();
  const normalFunctions: string[] = [];
  const recursiveFunctions: string[][] = [];

  for (const slot of slots) {
    if (!FUNCTION_NAMES.includes(slot.name)) {
      errors.push({ field: "functions", slotId: slot.id, message: "函数名只能是 f、g、h" });
      continue;
    }

    if (names.has(slot.name)) {
      errors.push({ field: "functions", slotId: slot.id, message: `${slot.name} 已被使用` });
    }
    names.add(slot.name);

    const params = normalizeParams(slot.params);
    if (!params) {
      errors.push({
        field: `params:${slot.id}`,
        slotId: slot.id,
        message: "参数只能从 x / y / z 中选择",
      });
    }

    if (slot.kind === "normal") {
      const body = validateFunctionLine(slot.body, `body:${slot.id}`, `${slot.name} 的函数体`, errors, slot.id);
      if (params) {
        normalFunctions.push(`${slot.name}(${params})=${body}`);
      }
      continue;
    }

    const base0 = validateFunctionLine(slot.base0, `base0:${slot.id}`, `${slot.name}{0}`, errors, slot.id);
    const base1 = validateFunctionLine(slot.base1, `base1:${slot.id}`, `${slot.name}{1}`, errors, slot.id);
    const recurrence = validateFunctionLine(
      slot.recurrence,
      `recurrence:${slot.id}`,
      `${slot.name}{n}`,
      errors,
      slot.id,
    );

    if (params) {
      recursiveFunctions.push([
        `${slot.name}{0}(${params})=${base0}`,
        `${slot.name}{1}(${params})=${base1}`,
        `${slot.name}{n}(${params})=${recurrence}`,
      ]);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    request: {
      normalFunctions,
      recursiveFunctions,
      expression: expression.trim(),
    },
  };
}
