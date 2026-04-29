import { describe, expect, it } from "vitest";
import {
  type FunctionSlot,
  getNextFunctionName,
  normalizeParams,
  validateWorkbench,
} from "./validation";

const normal = (name: "f" | "g" | "h", body = "x+1"): FunctionSlot => ({
  id: `normal-${name}`,
  name,
  kind: "normal",
  params: ["x", "y"],
  body,
});

const recursive = (name: "f" | "g" | "h"): FunctionSlot => ({
  id: `recursive-${name}`,
  name,
  kind: "recursive",
  params: ["x"],
  base0: "x",
  base1: "x^2",
  recurrence: `${name}{n-1}(x)+${name}{n-2}(x)`,
});

describe("validation", () => {
  it("assigns function names in f/g/h order", () => {
    expect(getNextFunctionName([])).toBe("f");
    expect(getNextFunctionName([normal("f")])).toBe("g");
    expect(getNextFunctionName([normal("f"), recursive("g")])).toBe("h");
    expect(getNextFunctionName([normal("f"), recursive("g"), normal("h")])).toBeUndefined();
  });

  it("reuses the earliest open slot after deletion", () => {
    expect(getNextFunctionName([normal("g"), normal("h")])).toBe("f");
  });

  it("normalizes and validates parameters", () => {
    expect(normalizeParams(["x", "y"])).toBe("x,y");
    expect(normalizeParams(["x", "x"])).toBeUndefined();
    expect(normalizeParams([])).toBeUndefined();
  });

  it("builds normal function requests", () => {
    const result = validateWorkbench([normal("f", "x+y")], "f(x,2)");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request).toEqual({
        normalFunctions: ["f(x,y)=x+y"],
        recursiveFunctions: [],
        expression: "f(x,2)",
      });
    }
  });

  it("builds recursive function requests", () => {
    const result = validateWorkbench([recursive("g")], "g{3}(x)");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.recursiveFunctions).toEqual([
        ["g{0}(x)=x", "g{1}(x)=x^2", "g{n}(x)=g{n-1}(x)+g{n-2}(x)"],
      ]);
    }
  });

  it("blocks empty expression and free y/z in the target expression", () => {
    const result = validateWorkbench([], "y+x");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.message)).toContain("目标表达式只允许自由变量 x");
    }
  });

  it("blocks invalid params and empty function bodies", () => {
    const invalidNormal: FunctionSlot = {
      id: "invalid-normal-f",
      name: "f",
      kind: "normal",
      params: [],
      body: "",
    };
    const result = validateWorkbench([invalidNormal], "f(x,2)");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining(["参数只能从 x / y / z 中选择", "f 的函数体不能为空"]),
      );
    }
  });

  it("blocks the three function limit", () => {
    const result = validateWorkbench([normal("f"), normal("g"), normal("h"), normal("f")], "x+x");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.message)).toContain("自定义函数最多只能添加 f/g/h 三个");
    }
  });
});
