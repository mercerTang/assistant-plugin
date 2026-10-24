# 贡献指南

感谢你愿意改进 AssistantPlugin。以下约定尽量短，目的只有一个：让改动可验证、可回滚。

## 开发环境

项目零依赖，只需要一个静态服务器：

```bash
cd assistant-plugin
python3 -m http.server 8090      # Windows: python -m http.server 8090
```

- 演示页：<http://localhost:8090/demo/>
- 自测页：<http://localhost:8090/demo/selftest.html>

## 目录约定

| 路径 | 用途 |
|---|---|
| `src/assistant-plugin.js` | 插件本体（唯一产物，保持单文件、零依赖） |
| `demo/index.html` | 演示宿主页 |
| `demo/agent.html` | 被嵌入的示例智能体页 |
| `demo/selftest.html` | 浏览器内断言自测 |
| `screenshots/` | 文档用截图 |

## 提交前自检

1. `node --check src/assistant-plugin.js` 无语法错误；
2. 打开 `demo/selftest.html`，16 条断言全部通过；
3. 手工过一遍：拖动图标、点击打开、拖四边/四角缩放、放大还原、关闭后图标回来；
4. 窗口缩到 400px 宽再看一次，面板不能超出视口。

## 代码风格

- ES5 语法为主（`var` / 函数声明），保证老浏览器可用；不引入构建步骤。
- 不新增第三方依赖；确有必要先在 issue 里讨论。
- 样式只写在 Shadow DOM 内部，禁止给宿主页面加全局样式或污染全局变量（只暴露 `window.AssistantPlugin`）。
- 注释写「为什么」，不写「这行在做什么」。

## 提交信息

```
<type>: <一句话说明>

type: feat | fix | docs | style | refactor | test | chore
```

示例：`fix: 顶部缩放热区被拖动层遮挡`

## 提 PR 之前

- 一个 PR 只做一件事，改动范围尽量小；
- 行为变化要同步更新 `README.md` 的配置表与行为说明；
- 新增能力请在 `demo/selftest.html` 里补一条断言，并在 PR 描述里贴出自测结果；
- 破坏性变更（改配置名、改默认值）需要在 PR 里写明迁移方式。
