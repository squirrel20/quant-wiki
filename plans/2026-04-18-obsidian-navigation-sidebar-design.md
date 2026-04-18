# Obsidian 章节导航侧边栏插件 — 设计文档

- **日期**：2026-04-18
- **范围**：私用插件，仅供 `quant-wiki` 这一个 vault 使用
- **目的**：把 `docs/navigation.md` 里的章节目录以可折叠树的形式放入 Obsidian 左侧栏，阅读时可快速跳转到任意页面

## 1. 已确认决策

| 维度 | 选择 |
|---|---|
| 范围 | 仅本 vault，硬编码假设 |
| 数据来源 | `docs/navigation.md`（硬编码路径） |
| 树形式 | 可折叠树；顶级章节默认折叠 |
| 点击行为 | 对齐 Obsidian 原生：点击 = 覆盖；Cmd/Ctrl+点击 = 新 tab；Shift+点击 = 新 split |
| 活跃文件 | 跟随当前打开的文件，自动展开所在章节并高亮滚到可见 |
| 更新策略 | 监听 `docs/navigation.md` 变更，300ms debounce 后重建树 |
| 侧边栏位置 | 左侧 |
| 入口 | Ribbon icon + Command Palette 命令 |
| 搜索框 | 不做（YAGNI） |
| 设置页 | 不做（YAGNI） |

## 2. 架构

单插件项目，TypeScript + esbuild 构建，产物放在 `.obsidian/plugins/quant-wiki-navigation/`。

```
.obsidian/plugins/quant-wiki-navigation/
├── manifest.json
├── main.ts              # plugin 入口 + ItemView + parser + watchers
├── styles.css
├── esbuild.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## 3. Parser 方案

**选 B：正则逐行解析**。navigation.md 是我们自己写、格式可控的文件，不值得引入 markdown AST 依赖。

解析规则（对应当前 navigation.md）：

- `^## (.+)$` → 顶级章节节点（折叠单位）
- `^- \*\*(.+)\*\*$` → 同章节内的分组（粗体行）
- `^(\s*)- \[([^\]]+)\]\(([^)]+)\)` → 叶子，缩进决定嵌套
- 纯文本条目 `- xxx`（无链接）→ 跳过（是注释/说明性）
- 同行含多个 `[text](link)` 片段（以 `·` 分隔）→ 拆成多个平级叶子
- `#` 后的文件内锚点保留在 href 里，交给 `openLinkText`
- `http(s)://…` 链接标记 `external: true`

异常行：`console.warn` 记录，跳过，不中断解析。

## 4. 数据模型

```ts
type NavNode = {
  title: string;
  href?: string;       // 只有叶子才有
  external?: boolean;  // true = 外链
  children: NavNode[];
};
```

- 顶级 `## 章节` → `NavNode { title, children: [...] }`
- 分组 `**加粗**` → 一个 `NavNode { title, children: [...] }`
- 叶子 `[text](path)` → `NavNode { title: text, href: path, children: [] }`

## 5. 组件与模块

### 5.1 `NavParser`（纯函数）
- 签名：`parse(md: string): NavNode[]`
- 无 I/O，方便单测
- 按章节（`## `）切段，段内再按缩进/前缀建层级

### 5.2 `NavigationView extends ItemView`
- `getViewType() = 'quant-wiki-navigation'`
- `getDisplayText() = '章节导航'`
- `getIcon() = 'list-tree'`
- `onOpen()`：读文件 → 解析 → 渲染 DOM；注册 workspace/vault 事件
- `onClose()`：清理监听
- 重渲染时保留已展开章节集合（以章节 title 为 key）

### 5.3 `Plugin.onload`（入口）
- `this.registerView(VIEW_TYPE, leaf => new NavigationView(leaf, this))`
- `this.addRibbonIcon('list-tree', '打开章节导航', () => this.activateView())`
- `this.addCommand({ id: 'open-chapter-navigation', name: '打开章节导航', callback })`
- `this.app.workspace.onLayoutReady(() => this.activateView())`（启动后自动在左栏挂载，若用户手动关闭过则不强推）

### 5.4 事件订阅

- `vault.on('modify', file)`：仅当 `file.path === 'docs/navigation.md'` 时，debounce 300ms → 重解析 + 重渲染
- `workspace.on('file-open', file)`：在树中匹配 `docs/<href>` ≈ `file.path`，展开所在章节 → 高亮 + `scrollIntoView({ block: 'nearest' })`

## 6. 数据流

```
启动
  └─> onLayoutReady
        └─> activateView()  →  NavigationView.onOpen()
              ├─> read docs/navigation.md
              ├─> NavParser.parse()  →  NavNode[]
              └─> render tree DOM
                    └─> emit file-open（如当前已有打开文件）→ 高亮

用户编辑 navigation.md 并保存
  └─> vault.on('modify')  →  debounce  →  重新 read + parse + render（保留展开状态）

用户点击节点
  ├─> 内部链接
  │     └─> workspace.openLinkText(href, '', newLeafMode)
  │           ├─ 无修饰键       → false       （覆盖当前）
  │           ├─ Cmd/Ctrl+点击  → 'tab'       （新 tab）
  │           └─ Shift+点击     → 'split'    （新 split）
  └─> 外链 http(s)
        └─> window.open(href)

用户切换 Obsidian 里的文件
  └─> workspace.on('file-open')  →  在 NavNode 树中查到对应叶子
        └─> 展开祖先章节 + 高亮 + scrollIntoView
```

## 7. 路径解析

navigation.md 里的链接是 mkdocs 视角（相对 `docs/`），而 Obsidian 操作的是 vault 根：

- `index.md` → vault 中 `docs/index.md`
- `basic/finance/index.md` → vault 中 `docs/basic/finance/index.md`
- `repo/quant_learn.md#backtesting-and-live-trading` → 传给 `openLinkText` 的 linktext 为 `docs/repo/quant_learn#backtesting-and-live-trading`（Obsidian 的 linktext 去 `.md`）

统一转换函数：

```ts
function toObsidianLinkText(href: string): string {
  const [pathPart, anchor] = href.split('#', 2);
  const noExt = pathPart.replace(/\.md$/, '');
  return anchor ? `docs/${noExt}#${anchor}` : `docs/${noExt}`;
}
```

## 8. 错误处理

| 情况 | 行为 |
|---|---|
| `docs/navigation.md` 不存在 | 视图渲染占位："Navigation file not found at docs/navigation.md" |
| 解析异常行 | `console.warn` + 跳过，不中断 |
| 链接解析不到文件 | 委托给 `openLinkText`，由 Obsidian 自己提示（与点击正文 wiki link 行为一致） |
| 监听回调抛错 | `try/catch` 包裹，`console.error`，保持视图存活 |

## 9. 视觉

- 复用 Obsidian 变量：`var(--nav-item-color)`、`var(--background-modifier-hover)`、`var(--text-accent)` 等
- 折叠三角形：`▸ / ▾`（CSS 旋转，不引图标）
- 当前活跃叶子：加 `is-active` class，`color: var(--text-accent); font-weight: 600;`
- 章节（h2）和分组（bold）字号略大于叶子，层级用左 padding 区分

## 10. 测试计划

**手动清单（在 vault 中跑一遍）**：
- [ ] 启动 Obsidian，左栏出现"章节导航"视图；11 个顶级章节都在
- [ ] 点击顶级章节 → 展开/折叠
- [ ] 点击叶子 → 当前面板打开
- [ ] Cmd/Ctrl+点叶子 → 新 tab 打开
- [ ] Shift+点叶子 → 新 split 打开
- [ ] 点击带锚点的链接（如量化百宝箱下的 `#backtesting-and-live-trading`）→ 打开文件并滚到该锚点
- [ ] 点击外链（如"GitHub 仓库"）→ 系统浏览器打开
- [ ] 手动用文件浏览器打开 `docs/ai/index.md` → 侧边栏自动展开"AI+量化"，`简介` 条目高亮
- [ ] 编辑 `docs/navigation.md`，新增一行章节，保存 → 侧边栏在 < 1s 内出现新章节
- [ ] 删除 `docs/navigation.md` → 视图显示占位而非崩溃

**单测（可选）**：
- `NavParser` 纯函数单测，用 `node --test` 或简单 `assert`，覆盖：章节、分组、单叶子、缩进嵌套、`·` 分隔的多链接行、异常行。

## 11. 范围外（YAGNI，明确不做）

- 搜索/过滤框
- 拖拽重排
- 主题定制、字体切换
- 多 vault 支持
- 从 mkdocs.yml 同步导航
- 发布到 Obsidian 社区插件市场
- 设置页
- 多语言

## 12. 开放问题 / 后续工作

- 若未来 navigation.md 格式大改（如改用 YAML frontmatter 的子项），正则 parser 需要对应升级。
- 若插件被分享给他人，需要补 README、LICENSE、发布流程；当前不做。
