# Obsidian Chapter-Navigation Sidebar Plugin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a private Obsidian plugin that renders `docs/navigation.md` as a collapsible tree in the left sidebar, with modifier-aware click behavior, active-file tracking, and live reload.

**Architecture:** Single TypeScript plugin installed at `.obsidian/plugins/quant-wiki-navigation/`. A pure-function parser converts `navigation.md` into a `NavNode[]` tree; a custom `ItemView` renders it, listens to `vault.on('modify')` for live reload, and to `workspace.on('file-open')` for active-file highlight. esbuild bundles `main.ts` → `main.js`. Parser gets automated tests via `node --test` + `tsx`; the view is validated via a manual checklist.

**Tech Stack:**
- TypeScript 5.x, esbuild 0.21+, Obsidian API (`obsidian` npm pkg)
- Dev: `tsx` for running `.ts` tests under `node --test`
- No runtime deps beyond Obsidian

**Design reference:** `plans/2026-04-18-obsidian-navigation-sidebar-design.md`

---

## Task 1: Scaffold plugin project

**Files:**
- Create: `.obsidian/plugins/quant-wiki-navigation/manifest.json`
- Create: `.obsidian/plugins/quant-wiki-navigation/package.json`
- Create: `.obsidian/plugins/quant-wiki-navigation/tsconfig.json`
- Create: `.obsidian/plugins/quant-wiki-navigation/esbuild.config.mjs`
- Create: `.obsidian/plugins/quant-wiki-navigation/.gitignore`
- Create: `.obsidian/plugins/quant-wiki-navigation/main.ts` (stub that logs `onload`)
- Create: `.obsidian/plugins/quant-wiki-navigation/README.md`

**Step 1: Write `manifest.json`**

```json
{
  "id": "quant-wiki-navigation",
  "name": "Quant Wiki Chapter Navigation",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Renders docs/navigation.md as a collapsible sidebar tree for this vault.",
  "author": "quant-wiki",
  "isDesktopOnly": false
}
```

**Step 2: Write `package.json`**

```json
{
  "name": "quant-wiki-navigation",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "node esbuild.config.mjs production",
    "dev": "node esbuild.config.mjs",
    "test": "node --import tsx --test tests/*.test.ts"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.21.0",
    "obsidian": "latest",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2022",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "Node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2022"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "main.js"]
}
```

**Step 4: Write `esbuild.config.mjs`**

```js
import esbuild from 'esbuild';

const prod = process.argv.includes('production');

const ctx = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2022',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  logLevel: 'info',
  outfile: 'main.js',
});

if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
```

**Step 5: Write `.gitignore`**

```
node_modules/
main.js
*.log
```

**Step 6: Write stub `main.ts`**

```ts
import { Plugin } from 'obsidian';

export default class QuantWikiNavigationPlugin extends Plugin {
  async onload() {
    console.log('[quant-wiki-navigation] loaded');
  }
  async onunload() {
    console.log('[quant-wiki-navigation] unloaded');
  }
}
```

**Step 7: Write minimal `README.md`**

```markdown
# Quant Wiki Chapter Navigation

Private Obsidian plugin that renders `docs/navigation.md` as a collapsible sidebar tree.

## Build

    npm install
    npm run build

## Dev

    npm run dev   # watch mode

## Test

    npm run test
```

**Step 8: Install deps and build**

```bash
cd .obsidian/plugins/quant-wiki-navigation
npm install
npm run build
```

Expected: `main.js` file appears alongside `main.ts`. No errors.

**Step 9: Verify plugin loads in Obsidian**

Manually in Obsidian: Settings → Community plugins → turn on "Installed plugins" → enable "Quant Wiki Chapter Navigation". Check the developer console (Cmd+Opt+I) for `[quant-wiki-navigation] loaded`.

Expected: plugin loads; console prints the log line.

**Step 10: Commit**

```bash
git add .obsidian/plugins/quant-wiki-navigation
git commit -m "feat(plugin): scaffold quant-wiki-navigation Obsidian plugin"
```

---

## Task 2: Parser — chapters and leaves (TDD)

**Files:**
- Create: `.obsidian/plugins/quant-wiki-navigation/parser.ts`
- Create: `.obsidian/plugins/quant-wiki-navigation/tests/parser.test.ts`

**Step 1: Write failing tests**

`tests/parser.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../parser.ts';

test('empty input returns empty array', () => {
  assert.deepEqual(parse(''), []);
});

test('single chapter with one leaf', () => {
  const md = [
    '## 简介',
    '',
    '- [关于项目](index.md)',
  ].join('\n');
  assert.deepEqual(parse(md), [
    {
      title: '简介',
      children: [
        { title: '关于项目', href: 'index.md', external: false, children: [] },
      ],
    },
  ]);
});

test('multiple chapters keep order', () => {
  const md = [
    '## A',
    '- [a1](a1.md)',
    '## B',
    '- [b1](b1.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'A');
  assert.equal(out[1].title, 'B');
});
```

**Step 2: Run tests (expect FAIL)**

```bash
cd .obsidian/plugins/quant-wiki-navigation
npm test
```

Expected: FAIL — `Cannot find module '../parser.ts'`.

**Step 3: Implement minimal parser**

`parser.ts`:

```ts
export type NavNode = {
  title: string;
  href?: string;
  external: boolean;
  children: NavNode[];
};

const CHAPTER_RE = /^##\s+(.+?)\s*$/;
const LEAF_RE = /^(\s*)-\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;

export function parse(md: string): NavNode[] {
  const chapters: NavNode[] = [];
  let current: NavNode | null = null;

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\r$/, '');

    const ch = line.match(CHAPTER_RE);
    if (ch) {
      current = { title: ch[1], external: false, children: [] };
      chapters.push(current);
      continue;
    }

    if (!current) continue;

    const lf = line.match(LEAF_RE);
    if (lf) {
      const href = lf[3].trim();
      current.children.push({
        title: lf[2].trim(),
        href,
        external: /^https?:\/\//i.test(href),
        children: [],
      });
    }
  }

  return chapters;
}
```

**Step 4: Run tests (expect PASS)**

```bash
npm test
```

Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add parser.ts tests/parser.test.ts
git commit -m "feat(parser): parse chapters and top-level leaves"
```

---

## Task 3: Parser — groups and indented nesting

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/parser.ts`
- Modify: `.obsidian/plugins/quant-wiki-navigation/tests/parser.test.ts`

**Step 1: Add failing tests**

Append to `tests/parser.test.ts`:

```ts
test('bold group with nested leaves', () => {
  const md = [
    '## 入门教程',
    '- **必懂概念入门**',
    '    - [夏普比率](start/sharpe.md)',
    '    - [波动率](start/volatility.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 1);
  const group = out[0].children[0];
  assert.equal(group.title, '必懂概念入门');
  assert.equal(group.href, undefined);
  assert.equal(group.children.length, 2);
  assert.equal(group.children[0].title, '夏普比率');
  assert.equal(group.children[0].href, 'start/sharpe.md');
});

test('leaves at chapter level and under group are separated', () => {
  const md = [
    '## X',
    '- [direct](d.md)',
    '- **group**',
    '    - [inside](i.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 2);
  assert.equal(out[0].children[0].title, 'direct');
  assert.equal(out[0].children[1].title, 'group');
  assert.equal(out[0].children[1].children[0].title, 'inside');
});
```

**Step 2: Run tests (expect FAIL for new cases)**

```bash
npm test
```

Expected: new group test fails — `group.children.length` is 0 because `LEAF_RE` only handles flat leaves.

**Step 3: Implement group + indent handling**

Replace `parser.ts` body (keep types same). Track an indent-indexed stack so deeper indents nest under the previous bullet:

```ts
export type NavNode = {
  title: string;
  href?: string;
  external: boolean;
  children: NavNode[];
};

const CHAPTER_RE = /^##\s+(.+?)\s*$/;
const GROUP_RE   = /^(\s*)-\s*\*\*(.+?)\*\*\s*$/;
const LEAF_RE    = /^(\s*)-\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;

function mkLeaf(title: string, href: string): NavNode {
  return { title: title.trim(), href: href.trim(), external: /^https?:\/\//i.test(href), children: [] };
}

export function parse(md: string): NavNode[] {
  const chapters: NavNode[] = [];
  let current: NavNode | null = null;

  // Stack of [indent, container]; containers are where new children go
  let stack: Array<{ indent: number; node: NavNode }> = [];

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\r$/, '');

    const ch = line.match(CHAPTER_RE);
    if (ch) {
      current = { title: ch[1], external: false, children: [] };
      chapters.push(current);
      stack = [{ indent: -1, node: current }];
      continue;
    }
    if (!current) continue;

    const group = line.match(GROUP_RE);
    if (group) {
      const indent = group[1].length;
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      const node: NavNode = { title: group[2].trim(), external: false, children: [] };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ indent, node });
      continue;
    }

    const leaf = line.match(LEAF_RE);
    if (leaf) {
      const indent = leaf[1].length;
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      stack[stack.length - 1].node.children.push(mkLeaf(leaf[2], leaf[3]));
      continue;
    }
  }

  return chapters;
}
```

**Step 4: Run tests (expect PASS)**

```bash
npm test
```

Expected: all 5 tests pass.

**Step 5: Commit**

```bash
git add parser.ts tests/parser.test.ts
git commit -m "feat(parser): support bold groups and indented nesting"
```

---

## Task 4: Parser — multi-link lines, anchors, external, skip plain text

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/parser.ts`
- Modify: `.obsidian/plugins/quant-wiki-navigation/tests/parser.test.ts`

**Step 1: Add failing tests**

```ts
test('multi-link line split by ·', () => {
  const md = [
    '## X',
    '- [a](a.md) · [b](b.md) · [c](c.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 3);
  assert.deepEqual(out[0].children.map(c => c.title), ['a', 'b', 'c']);
});

test('multi-link line with prefix text splits links only', () => {
  const md = [
    '## X',
    '- 多因子系列：[中信](advanced/a/index.md) · [华泰](advanced/b/index.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 2);
  assert.equal(out[0].children[0].title, '中信');
  assert.equal(out[0].children[1].title, '华泰');
});

test('external https link flagged', () => {
  const md = [
    '## X',
    '- [site](https://example.com)',
  ].join('\n');
  assert.equal(parse(md)[0].children[0].external, true);
});

test('anchor preserved in href', () => {
  const md = [
    '## X',
    '- [sec](repo/quant_learn.md#backtesting-and-live-trading)',
  ].join('\n');
  assert.equal(
    parse(md)[0].children[0].href,
    'repo/quant_learn.md#backtesting-and-live-trading'
  );
});

test('plain bullet without link is skipped', () => {
  const md = [
    '## X',
    '- 人工智能：AI 与机器学习、前沿技术应用',
    '- [real](r.md)',
  ].join('\n');
  const out = parse(md);
  assert.equal(out[0].children.length, 1);
  assert.equal(out[0].children[0].title, 'real');
});
```

**Step 2: Run tests (expect FAIL)**

```bash
npm test
```

Expected: multi-link tests fail because `LEAF_RE` only matches the first link; prefix-text tests fail similarly.

**Step 3: Implement multi-link extraction**

Add a global-link scan when the line contains ≥ 2 links. Replace the leaf-matching block in `parse()`:

```ts
const LINK_GLOBAL_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
```

And replace the leaf branch with:

```ts
    // Count links on the line
    const links = [...line.matchAll(LINK_GLOBAL_RE)];
    if (links.length >= 1 && /^\s*-\s/.test(line)) {
      const indentMatch = line.match(/^(\s*)-/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      for (const m of links) {
        stack[stack.length - 1].node.children.push(mkLeaf(m[1], m[2]));
      }
      continue;
    }
```

Remove the now-unused `LEAF_RE` + its branch.

**Step 4: Run tests (expect PASS)**

```bash
npm test
```

Expected: all 10 tests pass. The "plain bullet without link" test passes because `links.length === 0` short-circuits.

**Step 5: Commit**

```bash
git add parser.ts tests/parser.test.ts
git commit -m "feat(parser): handle multi-link lines, anchors, external flag"
```

---

## Task 5: Link resolution helper

**Files:**
- Create: `.obsidian/plugins/quant-wiki-navigation/links.ts`
- Create: `.obsidian/plugins/quant-wiki-navigation/tests/links.test.ts`

**Step 1: Write failing tests**

`tests/links.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toObsidianLinkText } from '../links.ts';

test('plain .md path', () => {
  assert.equal(toObsidianLinkText('index.md'), 'docs/index');
});

test('nested .md path', () => {
  assert.equal(toObsidianLinkText('basic/finance/index.md'), 'docs/basic/finance/index');
});

test('path with anchor', () => {
  assert.equal(
    toObsidianLinkText('repo/quant_learn.md#backtesting-and-live-trading'),
    'docs/repo/quant_learn#backtesting-and-live-trading'
  );
});

test('path without .md extension', () => {
  assert.equal(toObsidianLinkText('repo/quant_learn'), 'docs/repo/quant_learn');
});
```

**Step 2: Run tests (expect FAIL — module missing)**

```bash
npm test
```

**Step 3: Implement**

`links.ts`:

```ts
export function toObsidianLinkText(href: string): string {
  const [pathPart, anchor] = href.split('#', 2);
  const noExt = pathPart.replace(/\.md$/, '');
  const full = `docs/${noExt}`;
  return anchor ? `${full}#${anchor}` : full;
}
```

**Step 4: Run tests (expect PASS)**

```bash
npm test
```

**Step 5: Commit**

```bash
git add links.ts tests/links.test.ts
git commit -m "feat(links): add toObsidianLinkText helper"
```

---

## Task 6: NavigationView skeleton + plugin wiring

**Files:**
- Create: `.obsidian/plugins/quant-wiki-navigation/view.ts`
- Modify: `.obsidian/plugins/quant-wiki-navigation/main.ts`

**Step 1: Write `view.ts` (placeholder render)**

```ts
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE = 'quant-wiki-navigation';

export class NavigationView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return '章节导航'; }
  getIcon(): string { return 'list-tree'; }

  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.createDiv({ text: '章节导航 (loading…)', cls: 'qwn-placeholder' });
  }

  async onClose() {}
}
```

**Step 2: Update `main.ts` — register view, ribbon, command, auto-open**

```ts
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { NavigationView, VIEW_TYPE } from './view';

export default class QuantWikiNavigationPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new NavigationView(leaf));

    this.addRibbonIcon('list-tree', '打开章节导航', () => this.activateView());
    this.addCommand({
      id: 'open-chapter-navigation',
      name: '打开章节导航',
      callback: () => this.activateView(),
    });

    this.app.workspace.onLayoutReady(() => this.activateView(false));
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView(reveal = true) {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getLeftLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (reveal) workspace.revealLeaf(leaf);
  }
}
```

**Step 3: Build**

```bash
npm run build
```

Expected: `main.js` rebuilt, no errors.

**Step 4: Reload plugin in Obsidian**

Settings → Community plugins → disable "Quant Wiki Chapter Navigation" → enable. Or run "Reload without saving" from command palette.

Expected:
- Left sidebar shows a "章节导航" tab
- Content: placeholder text "章节导航 (loading…)"
- Ribbon icon `list-tree` visible; clicking focuses the view
- Command palette "打开章节导航" focuses the view

**Step 5: Commit**

```bash
git add main.ts view.ts
git commit -m "feat(view): register NavigationView with ribbon and command entry"
```

---

## Task 7: Render tree from navigation.md

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/view.ts`
- Create: `.obsidian/plugins/quant-wiki-navigation/render.ts`

**Step 1: Implement tree renderer**

`render.ts`:

```ts
import { NavNode } from './parser';

export type ExpandedSet = Set<string>;

/** Render nav tree into `root`. Returns element list keyed by href for active tracking. */
export function renderTree(
  root: HTMLElement,
  nodes: NavNode[],
  expanded: ExpandedSet,
  onToggle: (chapterTitle: string, willExpand: boolean) => void,
  onLeafClick: (node: NavNode, evt: MouseEvent) => void,
): Map<string, HTMLElement> {
  root.empty();
  const leafByHref = new Map<string, HTMLElement>();
  const list = root.createDiv({ cls: 'qwn-tree' });

  for (const chapter of nodes) {
    const chapterEl = list.createDiv({ cls: 'qwn-chapter' });
    const header = chapterEl.createDiv({ cls: 'qwn-chapter-header' });
    const triangle = header.createSpan({ cls: 'qwn-triangle', text: '▸' });
    header.createSpan({ cls: 'qwn-chapter-title', text: chapter.title });

    const body = chapterEl.createDiv({ cls: 'qwn-chapter-body' });
    const isOpen = expanded.has(chapter.title);
    body.style.display = isOpen ? '' : 'none';
    triangle.setText(isOpen ? '▾' : '▸');

    header.addEventListener('click', () => {
      const nowOpen = body.style.display === 'none';
      body.style.display = nowOpen ? '' : 'none';
      triangle.setText(nowOpen ? '▾' : '▸');
      onToggle(chapter.title, nowOpen);
    });

    renderChildren(body, chapter.children, 0, leafByHref, onLeafClick);
  }

  return leafByHref;
}

function renderChildren(
  parent: HTMLElement,
  nodes: NavNode[],
  depth: number,
  leafByHref: Map<string, HTMLElement>,
  onLeafClick: (node: NavNode, evt: MouseEvent) => void,
) {
  for (const n of nodes) {
    if (n.href) {
      const leaf = parent.createDiv({ cls: 'qwn-leaf', text: n.title });
      leaf.style.paddingLeft = `${12 + depth * 12}px`;
      leaf.addEventListener('click', (evt) => onLeafClick(n, evt));
      leafByHref.set(n.href, leaf);
    } else {
      const group = parent.createDiv({ cls: 'qwn-group' });
      group.createDiv({ cls: 'qwn-group-title', text: n.title }).style.paddingLeft = `${12 + depth * 12}px`;
      renderChildren(group, n.children, depth + 1, leafByHref, onLeafClick);
    }
  }
}
```

**Step 2: Wire renderer into `view.ts`**

```ts
import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { NavNode, parse } from './parser';
import { renderTree, ExpandedSet } from './render';

export const VIEW_TYPE = 'quant-wiki-navigation';
const NAV_FILE = 'docs/navigation.md';

export class NavigationView extends ItemView {
  private expanded: ExpandedSet = new Set();
  private leafByHref: Map<string, HTMLElement> = new Map();

  constructor(leaf: WorkspaceLeaf) { super(leaf); }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '章节导航'; }
  getIcon() { return 'list-tree'; }

  async onOpen() {
    await this.rebuild();
  }

  async onClose() {}

  private async rebuild() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('qwn-root');

    const file = this.app.vault.getAbstractFileByPath(NAV_FILE);
    if (!(file instanceof TFile)) {
      root.createDiv({ cls: 'qwn-placeholder', text: `Navigation file not found at ${NAV_FILE}` });
      return;
    }

    const md = await this.app.vault.cachedRead(file);
    let tree: NavNode[];
    try {
      tree = parse(md);
    } catch (err) {
      console.error('[qwn] parse error', err);
      root.createDiv({ cls: 'qwn-placeholder', text: 'Failed to parse navigation.md (see console)' });
      return;
    }

    this.leafByHref = renderTree(
      root,
      tree,
      this.expanded,
      (title, open) => { open ? this.expanded.add(title) : this.expanded.delete(title); },
      (node, evt) => this.handleLeafClick(node, evt),
    );
  }

  private handleLeafClick(node: NavNode, _evt: MouseEvent) {
    // Wired in Task 8
    console.log('[qwn] click', node);
  }
}
```

**Step 3: Build and reload**

```bash
npm run build
```

In Obsidian: disable + re-enable plugin.

Expected: left sidebar shows 11 chapters, each collapsed with `▸`. Clicking a chapter toggles expand/collapse. Leaves render but clicks only log for now.

**Step 4: Commit**

```bash
git add view.ts render.ts
git commit -m "feat(view): render collapsible chapter tree from navigation.md"
```

---

## Task 8: Modifier-key click behavior + external links

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/view.ts`

**Step 1: Replace `handleLeafClick`**

```ts
import { toObsidianLinkText } from './links';

private handleLeafClick(node: NavNode, evt: MouseEvent) {
  if (!node.href) return;

  if (node.external) {
    window.open(node.href, '_blank');
    return;
  }

  // Modifier → new leaf mode. Match Obsidian native:
  //   Cmd/Ctrl → new tab
  //   Shift     → new split
  //   otherwise → current pane (false)
  const newLeaf: 'tab' | 'split' | false =
    (evt.metaKey || evt.ctrlKey) ? 'tab' :
    evt.shiftKey ? 'split' : false;

  const linkText = toObsidianLinkText(node.href);
  this.app.workspace.openLinkText(linkText, '', newLeaf);
}
```

**Step 2: Build and reload**

```bash
npm run build
```

In Obsidian, reload plugin.

**Step 3: Manual verification**

- Click a leaf (no modifier) → current active pane navigates to the file.
- Cmd/Ctrl+click → opens in new tab.
- Shift+click → opens as split.
- Click "GitHub 仓库" (external) → opens in system browser.
- Click a `#anchor` link (e.g. under 量化百宝箱) → opens file scrolled to that heading.

Expected: all five behaviors work.

**Step 4: Commit**

```bash
git add view.ts
git commit -m "feat(view): modifier-aware click + external link handling"
```

---

## Task 9: Live reload on navigation.md change (debounced)

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/view.ts`

**Step 1: Register debounced vault listener in `onOpen`**

Add inside the `NavigationView` class:

```ts
import { debounce } from 'obsidian';

private debouncedRebuild = debounce(() => this.rebuild(), 300, true);
```

Then extend `onOpen`:

```ts
async onOpen() {
  await this.rebuild();
  this.registerEvent(
    this.app.vault.on('modify', (file) => {
      if (file.path === NAV_FILE) this.debouncedRebuild();
    }),
  );
}
```

**Step 2: Build and reload**

```bash
npm run build
```

**Step 3: Manual verification**

- Open `docs/navigation.md` in a pane, add a new line `- [test](index.md)` at the bottom of some `## Section`, save.
- Within ~0.5s the sidebar tree should update, keeping previously-expanded chapters open (expanded state is preserved via `this.expanded`).
- Remove the line, save — tree reverts.

Expected: live reload works, expanded state survives.

**Step 4: Commit**

```bash
git add view.ts
git commit -m "feat(view): live reload nav tree on navigation.md change"
```

---

## Task 10: Active-file tracking

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/view.ts`

**Step 1: Extend `onOpen` with file-open listener**

```ts
async onOpen() {
  await this.rebuild();
  this.registerEvent(
    this.app.vault.on('modify', (file) => {
      if (file.path === NAV_FILE) this.debouncedRebuild();
    }),
  );
  this.registerEvent(
    this.app.workspace.on('file-open', (file) => this.highlightActive(file)),
  );
  this.highlightActive(this.app.workspace.getActiveFile());
}
```

**Step 2: Implement `highlightActive`**

```ts
private highlightActive(file: import('obsidian').TFile | null) {
  const root = this.containerEl.children[1] as HTMLElement;
  root.querySelectorAll('.qwn-leaf.is-active').forEach((el) => el.classList.remove('is-active'));
  if (!file) return;

  // Match file.path (e.g. "docs/basic/index.md") against hrefs (e.g. "basic/index.md")
  const relative = file.path.startsWith('docs/') ? file.path.slice('docs/'.length) : null;
  if (!relative) return;

  // Try exact match first, then match with #anchor stripped
  let el = this.leafByHref.get(relative);
  if (!el) {
    for (const [href, candidate] of this.leafByHref) {
      if (href.split('#')[0] === relative) { el = candidate; break; }
    }
  }
  if (!el) return;

  el.classList.add('is-active');

  // Expand ancestor chapter
  const chapterBody = el.closest('.qwn-chapter-body') as HTMLElement | null;
  if (chapterBody && chapterBody.style.display === 'none') {
    const chapter = chapterBody.parentElement as HTMLElement;
    const header = chapter.querySelector('.qwn-chapter-header') as HTMLElement | null;
    header?.click();
  }

  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
```

Also call `this.highlightActive(this.app.workspace.getActiveFile())` at the end of `rebuild()` so re-renders don't lose the highlight.

**Step 3: Build and reload**

```bash
npm run build
```

**Step 4: Manual verification**

- Open `docs/ai/index.md` via file explorer → in the nav sidebar, the "AI+量化" chapter auto-expands and "简介" entry is highlighted.
- Click a sidebar leaf → same file highlights (self-consistency check).
- Open a file not in navigation.md (e.g. some random library book) → no highlight, no error.

Expected: correct highlighting in all three cases.

**Step 5: Commit**

```bash
git add view.ts
git commit -m "feat(view): highlight and auto-expand active file in nav tree"
```

---

## Task 11: Styles

**Files:**
- Create: `.obsidian/plugins/quant-wiki-navigation/styles.css`

**Step 1: Write `styles.css`**

```css
.qwn-root {
  padding: 4px 0;
  user-select: none;
}
.qwn-placeholder {
  padding: 12px;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
}
.qwn-tree {
  display: flex;
  flex-direction: column;
}
.qwn-chapter-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--nav-item-color);
}
.qwn-chapter-header:hover {
  background: var(--background-modifier-hover);
}
.qwn-triangle {
  display: inline-block;
  width: 10px;
  font-size: 10px;
  color: var(--text-muted);
}
.qwn-group-title {
  font-weight: 600;
  color: var(--text-muted);
  padding-top: 6px;
  padding-bottom: 2px;
  font-size: var(--font-ui-small);
}
.qwn-leaf {
  padding: 4px 12px;
  cursor: pointer;
  color: var(--nav-item-color);
  font-size: var(--font-ui-small);
  line-height: 1.4;
  border-radius: 4px;
  margin: 0 4px;
}
.qwn-leaf:hover {
  background: var(--background-modifier-hover);
  color: var(--nav-item-color-hover);
}
.qwn-leaf.is-active {
  color: var(--text-accent);
  font-weight: 600;
  background: var(--background-modifier-active-hover);
}
```

Obsidian auto-loads `styles.css` next to `main.js`, no import needed.

**Step 2: Build and reload**

```bash
npm run build
```

**Step 3: Manual verification**

- Triangles (`▸/▾`) indent correctly; hover highlights work; active leaf is accented; indentation increases with group depth.
- Toggle dark/light theme → colors still look right (they use CSS variables).

**Step 4: Commit**

```bash
git add styles.css
git commit -m "feat(styles): style collapsible nav tree with theme variables"
```

---

## Task 12: Full manual-test pass + README polish

**Files:**
- Modify: `.obsidian/plugins/quant-wiki-navigation/README.md`

**Step 1: Run full checklist**

Open the Obsidian vault, reload plugin. Tick each item (fix if failing):

- [ ] Left sidebar shows "章节导航" with all 11 top-level chapters
- [ ] All chapters start collapsed (`▸`)
- [ ] Click chapter header toggles open/close (`▾ ⇄ ▸`)
- [ ] Click a leaf (no modifier) opens file in current pane
- [ ] Cmd/Ctrl+click a leaf opens in new tab
- [ ] Shift+click a leaf opens as split
- [ ] Click a leaf with `#anchor` (量化百宝箱 → 回测与实盘交易) scrolls to that heading
- [ ] Click external link (GitHub 仓库) opens in system browser
- [ ] Manually open `docs/ai/index.md` → AI+量化 auto-expands and "简介" is highlighted
- [ ] Edit `docs/navigation.md` (add a line in 简介), save → sidebar updates within ~0.5s, other expanded chapters stay expanded
- [ ] Delete `docs/navigation.md` (move to trash) → view shows "Navigation file not found"; restore → auto re-renders
- [ ] Ribbon icon opens/focuses the view
- [ ] Command palette → "打开章节导航" → opens/focuses the view
- [ ] Toggle dark/light theme → colors remain correct

**Step 2: Update README**

Replace stub with:

```markdown
# Quant Wiki Chapter Navigation

Private Obsidian plugin for the `quant-wiki` vault. Renders
`docs/navigation.md` as a collapsible sidebar tree so you can
jump between wiki pages while reading.

## Features

- Collapsible chapter tree with group-level indentation
- Modifier-aware clicks: click = current pane, Cmd/Ctrl+click = new tab, Shift+click = new split
- External `http(s)` links open in the system browser
- Active file is highlighted; its chapter auto-expands
- Edits to `docs/navigation.md` live-reload the tree (debounced)

## Install

The plugin ships inside this vault at `.obsidian/plugins/quant-wiki-navigation/`.
Enable it under Settings → Community plugins.

## Develop

    cd .obsidian/plugins/quant-wiki-navigation
    npm install
    npm run dev      # watch build
    npm run test     # parser + links unit tests
```

**Step 3: Final commit**

```bash
git add README.md
git commit -m "docs(plugin): document plugin usage and dev workflow"
```

---

## Done criteria

- `npm test` passes (10 parser tests + 4 link tests)
- Manual checklist in Task 12 fully ticked
- All commits landed on current branch

## Out of scope (per design)

No search box, no drag-reorder, no settings UI, no multi-vault support, no mkdocs.yml sync, no community publish flow. Re-open brainstorming if any of these come up.
