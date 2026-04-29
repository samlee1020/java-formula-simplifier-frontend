# 前端调用后端接口指南

本文档面向前端开发者或前端开发 agent，记录当前后端部署信息、接口调用方式、请求体格式、合法输入限制和推荐的前端处理方式。

## 1. 后端部署信息

当前后端已经部署在 Render Web Service：

```text
https://java-formula-simplifier-service.onrender.com
```

建议前端统一维护 API base URL：

```ts
export const API_BASE_URL = "https://java-formula-simplifier-service.onrender.com";
```

当前部署状态：

- 平台：Render Web Service
- 运行方式：Docker
- 后端框架：Spring Boot
- API 前缀：`/api/v1`
- 鉴权：暂无
- 数据库：暂无
- 会话状态：无状态；每次请求都会创建独立计算上下文，函数定义不会跨请求共享
- 当前 CORS：`CORS_ALLOWED_ORIGINS=*`，即任意来源暂时允许访问

正式前端域名确定后，建议把 Render 环境变量 `CORS_ALLOWED_ORIGINS` 改为明确域名，例如：

```text
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

多个域名用英文逗号分隔：

```text
CORS_ALLOWED_ORIGINS=https://app.example.com,https://preview.example.com
```

## 2. 接口总览

### 健康检查

```http
GET /api/v1/health
```

完整地址：

```text
https://java-formula-simplifier-service.onrender.com/api/v1/health
```

成功响应：

```json
{
  "status": "UP"
}
```

### 表达式化简

```http
POST /api/v1/simplify
Content-Type: application/json
```

完整地址：

```text
https://java-formula-simplifier-service.onrender.com/api/v1/simplify
```

成功响应：

```json
{
  "result": "x+2"
}
```

失败响应：

```json
{
  "code": "INVALID_REQUEST",
  "message": "请求参数错误",
  "detail": "expression must not be blank"
}
```

常见错误码：

| HTTP 状态码 | `code` | 含义 | 前端建议 |
| --- | --- | --- | --- |
| `400` | `INVALID_REQUEST` | 请求体缺失、JSON 错误、字段为空、递推函数不是 3 行、长度或数量超限 | 提示用户修正输入 |
| `400` | `INVALID_FUNCTION_DEFINITION` | 函数定义格式不符合后端解析要求 | 定位到函数定义区域提示 |
| `400` | `INVALID_EXPRESSION` | 目标表达式格式错误或解析失败 | 定位到表达式输入区域提示 |
| `500` | `INTERNAL_ERROR` | 未预期服务端错误 | 显示通用错误并建议稍后重试 |

## 3. 请求体格式

`POST /api/v1/simplify` 的请求体：

```ts
type SimplifyRequest = {
  normalFunctions: string[];
  recursiveFunctions: string[][];
  expression: string;
};
```

推荐前端始终传完整三个字段：

```json
{
  "normalFunctions": ["f(x,y)=x+y"],
  "recursiveFunctions": [],
  "expression": "f(x,2)"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `normalFunctions` | `string[]` | 推荐必传 | 普通函数定义列表；无普通函数时传 `[]` |
| `recursiveFunctions` | `string[][]` | 推荐必传 | 递推函数定义列表；每个递推函数必须恰好 3 行；无递推函数时传 `[]` |
| `expression` | `string` | 是 | 需要化简的目标表达式，不能为空 |

当前后端对缺失或 `null` 的函数数组会按空数组处理，但前端应固定传 `[]`，减少兼容风险。

## 4. 合法输入限制

这一节是前端输入校验最应该同步实现的部分。

### 请求级限制

- `expression` 必须存在，且去掉首尾空白后不能为空。
- 后端会删除所有空白字符后再解析，例如 `x + x` 会按 `x+x` 处理。
- 面向前端产品时，目标表达式只应把 `x` 作为自由自变量；`y`、`z` 只用于函数定义的形参名，不建议允许用户在目标表达式中直接输入自由的 `y`、`z`。
- 删除空白后的 `expression` 长度不能超过 `10000`。
- 普通函数定义数量加递推函数定义组数量不能超过 `64`。
- 每一行函数定义删除空白后长度不能超过 `5000`。
- 每一行函数定义不能为空。
- 每个递推函数定义组必须恰好包含 `3` 行。

### 普通函数定义限制

普通函数定义格式：

```text
f(x,y)=表达式
```

约束：

- 函数名建议只使用 `f`、`g`、`h`。
- 定义行必须以函数名开头，例如 `f(x)=x+1`。
- 形参写在英文小括号内，用英文逗号分隔。
- 形参建议只使用单字符 `x`、`y`、`z`。
- 形参顺序不固定，后端按位置绑定实参。例如 `f(y,x)=y-x` 调用 `f(2,x)` 会把 `y=2`、`x=x`，结果为 `2-x`。
- 普通函数调用示例：`f(x,2)`、`g(x)`。
- 每个请求内定义的函数只对本次请求有效。

示例：

```json
{
  "normalFunctions": ["f(x,y)=x+y"],
  "recursiveFunctions": [],
  "expression": "f(x,2)"
}
```

预期：

```json
{
  "result": "x+2"
}
```

### 递推函数定义限制

每个递推函数必须用三行定义，顺序固定：

```text
f{0}(x,y)=初值表达式0
f{1}(x,y)=初值表达式1
f{n}(x,y)=递推表达式
```

约束：

- 每个递推函数定义组必须恰好是 3 个字符串。
- 函数名建议只使用 `f`、`g`、`h`。
- 形参可以有多个，建议使用 `x`、`y`、`z`，例如 `g{0}(x,y)=x+y`。
- 形参顺序不固定，可以写成 `g{0}(y,x)=...`。
- 同一个递推函数三行的形参列表和顺序必须保持一致，例如都写 `g{0}(y,x)`、`g{1}(y,x)`、`g{n}(y,x)`。
- 当前后端只从第 0 行读取形参列表，不会校验第 1 行和第 n 行是否一致；前端必须主动校验一致性，否则请求可能不报错但语义会混乱。
- 前两行分别定义 `{0}` 和 `{1}`。
- 第三行定义 `{n}`。
- 递推关系主要支持 `n-1` 和 `n-2`，例如 `f{n-1}(x,y)`、`f{n-2}(x,y)`。
- 不建议使用 `n-3`、`n+1`、单独 `n` 等更复杂下标关系。
- 调用时使用具体非负整数下标，并传入对应数量的实参，例如 `f{3}(x)`、`g{2}(x,2)`。
- 前端目标表达式里的函数实参建议只使用整数、`x`、或由 `x` 构成的括号表达式，例如 `g{2}(x,2)`、`g{2}((x+1),2)`。
- 多形参递推函数已在线上验证可用；但 `y`、`z` 应作为函数定义里的形参占位符使用，不作为目标表达式自由变量。

示例：

```json
{
  "normalFunctions": [],
  "recursiveFunctions": [
    [
      "g{0}(x,y)=x+y",
      "g{1}(x,y)=x*y",
      "g{n}(x,y)=g{n-1}(x,y)+g{n-2}(x,y)"
    ]
  ],
  "expression": "g{2}(x,2)"
}
```

预期：

```json
{
  "result": "3*x+2"
}
```

### 表达式语法限制

当前核心语法支持：

- 整数常量：`0`、`1`、`123`
- 变量：目标表达式面向前端时只开放自由变量 `x`；`y`、`z` 仅作为函数定义形参使用
- 加减乘：`+`、`-`、`*`
- 乘方：`^`，指数写整数，例如 `x^2`、`(x+1)^3`
- 括号表达式：`(x+1)`
- 三角函数：`sin(x)`、`cos(x)`，可带指数，例如 `sin(x)^2`
- 普通函数调用：`f(x,2)`
- 递推函数调用：`f{3}(x)`、`g{2}(x,2)`
- 求导：`dx(x^2+sin(x))`

必须注意：

- 不支持隐式乘法，必须写 `2*x`，不能写 `2x`。
- 函数实参按“因子”解析；如果要传完整表达式，需要额外加括号。
- 推荐写 `f((x+1),2)`，不要写 `f(x+1,2)`。
- 三角函数内部如果是完整表达式，也建议额外加括号：`sin((x+1))`。
- 内部多项式输出统一按 `x` 表示，不要把它当作完整多元代数系统；前端不要开放自由 `y`、`z` 输入。
- 输出项顺序不保证符合数学书写习惯，前端不要依赖项顺序做严格判断。

## 5. 前端调用示例

### fetch 示例

```ts
const API_BASE_URL = "https://java-formula-simplifier-service.onrender.com";

type SimplifyRequest = {
  normalFunctions: string[];
  recursiveFunctions: string[][];
  expression: string;
};

type SimplifyResponse = {
  result: string;
};

type ApiErrorResponse = {
  code: string;
  message: string;
  detail: string;
};

async function simplify(request: SimplifyRequest): Promise<SimplifyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/simplify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiErrorResponse;
    throw new Error(error.detail || error.message || "Simplify request failed");
  }

  return data as SimplifyResponse;
}
```

调用：

```ts
const data = await simplify({
  normalFunctions: ["f(x,y)=x+y"],
  recursiveFunctions: [],
  expression: "f(x,2)"
});

console.log(data.result); // x+2
```

### 健康检查示例

```ts
async function checkBackendHealth(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`);
  if (!response.ok) {
    return false;
  }
  const data = await response.json();
  return data.status === "UP";
}
```

## 6. 建议的前端表单设计

推荐 UI 分成三块：

- 普通函数定义：多行列表，每行一个字符串，例如 `f(x,y)=x+y`。
- 递推函数定义：每个递推函数一个 3 行输入组，允许多形参，例如 `g{0}(x,y)=x+y`。
- 目标表达式：单个输入框或编辑器，例如 `f(x,2)+g{3}(x)`。

前端提交前建议做这些校验：

- `expression.trim()` 不能为空。
- 目标表达式只允许自由变量 `x`；`y`、`z` 只允许出现在函数定义形参和函数体中。
- 删除空白后的 `expression` 长度不超过 `10000`。
- `normalFunctions.length + recursiveFunctions.length <= 64`。
- 普通函数每行不能为空，删除空白后长度不超过 `5000`。
- 每个递推函数组必须是 3 行，且每行不能为空，删除空白后长度不超过 `5000`。
- 每个递推函数 3 行的形参列表必须完全一致，包括顺序。例如 `g{0}(y,x)`、`g{1}(y,x)`、`g{n}(y,x)` 合法；`g{0}(y,x)`、`g{1}(x,y)` 不应允许。
- 提醒用户必须显式写乘号：`2*x`。
- 对复杂函数参数给出提示：使用额外括号，例如 `f((x+1),2)`。

## 7. 线上接口测试命令

健康检查：

```bash
curl https://java-formula-simplifier-service.onrender.com/api/v1/health
```

普通表达式：

```bash
curl -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": [],
    "recursiveFunctions": [],
    "expression": "x+x"
  }'
```

普通函数：

```bash
curl -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": ["f(x,y)=x+y"],
    "recursiveFunctions": [],
    "expression": "f(x,2)"
  }'
```

递推函数：

```bash
curl -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": [],
    "recursiveFunctions": [
      [
        "g{0}(x)=x",
        "g{1}(x)=x^2",
        "g{n}(x)=g{n-1}(x)+g{n-2}(x)"
      ]
    ],
    "expression": "g{3}(x)"
  }'
```

多形参递推函数：

```bash
curl -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": [],
    "recursiveFunctions": [
      [
        "g{0}(x,y)=x+y",
        "g{1}(x,y)=x*y",
        "g{n}(x,y)=g{n-1}(x,y)+g{n-2}(x,y)"
      ]
    ],
    "expression": "g{2}(x,2)"
  }'
```

求导：

```bash
curl -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": [],
    "recursiveFunctions": [],
    "expression": "dx(x^2+sin(x))"
  }'
```

错误响应：

```bash
curl -i -X POST https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Content-Type: application/json' \
  -d '{
    "normalFunctions": [],
    "recursiveFunctions": []
  }'
```

CORS 预检：

```bash
curl -i -X OPTIONS https://java-formula-simplifier-service.onrender.com/api/v1/simplify \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

当前预期会返回：

```text
Access-Control-Allow-Origin: *
```

## 8. 当前已验证结果

线上服务最近一次验证结果：

- `GET /api/v1/health` 返回 `{"status":"UP"}`。
- `x+x` 返回 `2*x`。
- `f(x,2)` 返回 `x+2`。
- 普通函数形参乱序 `f(y,x)=y-x` 调用 `f(2,x)` 返回 `2-x`。
- `g{3}(x)` 返回 `2*x^2+x`。
- 多形参递推 `g{2}(x,2)` 返回 `3*x+2`。
- 三形参递推 `h{2}(x,2,3)` 返回 `3*x+8`。
- 递推函数形参乱序且三行一致时，`g{2}(2,x)` 返回 `x+2`。
- 递推函数三行形参顺序不一致时，后端当前不会报错，但会按第 0 行形参列表解释，前端必须拦截。
- `dx(x^2+sin(x))` 返回 `2*x+cos(x)`。
- 缺少 `expression` 返回 `400`，错误码为 `INVALID_REQUEST`。
- CORS 预检对任意 origin 返回 `Access-Control-Allow-Origin: *`。

## 9. 前端开发注意事项

- Render 免费实例可能冷启动，第一次请求可能比较慢；前端应显示 loading 状态。
- 后端错误响应是 JSON，前端应优先展示 `detail`，其次展示 `message`。
- 不要在前端缓存函数定义到后端；后端不保存状态，每次请求必须带完整函数定义和目标表达式。
- 不要把输出字符串拆成强结构后再判断数学等价性；目前后端只返回字符串。
- 生产环境建议把 CORS 从 `*` 收紧到真实前端域名。
