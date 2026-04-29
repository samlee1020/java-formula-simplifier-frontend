# 公式化简工作台

一个用于调用 Java 公式化简后端的 Vite + React 前端。这个项目源于 samlee1020 的课程学习，功能较弱仅供娱乐。

- [前端仓库](https://github.com/samlee1020/java-formula-simplifier-frontend)
- [后端仓库](https://github.com/samlee1020/java-formula-simplifier-service)

## 本地开发

```bash
npm install
npm run dev
```

默认后端地址为：

```text
https://java-formula-simplifier-service.onrender.com
```

如需覆盖后端地址，创建 `.env.local`：

```bash
VITE_API_BASE_URL=https://your-service.example.com
```

## 可用脚本

```bash
npm test
npm run build
npm run test:e2e
```

## Vercel 部署

项目已包含 `vercel.json`，适合作为 Vite 静态站点部署：

[demo地址](https://formula-simplifier.vercel.app/)

部署选项：

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: `>=20.19.0`
- Environment Variable: `VITE_API_BASE_URL`
