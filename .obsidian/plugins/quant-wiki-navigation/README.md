# Quant Wiki Chapter Navigation

Private Obsidian plugin for the `quant-wiki` vault. Renders
`docs/navigation.md` as a collapsible sidebar tree so you can
jump between wiki pages while reading.

## Features

- Collapsible chapter tree with group-level indentation
- Modifier-aware clicks: click = current pane, Cmd/Ctrl+click = new tab, Shift+click = new split
- External `http(s)` links open in the system browser
- Active file is highlighted; its chapter auto-expands
- Edits to `docs/navigation.md` live-reload the tree (debounced 300ms)
- Handles duplicate hrefs (e.g. `index.md` appearing in both 简介 and 其他入口) by highlighting every occurrence
- Right-click any item for context menu: 复制文本 (all items), plus 复制相对路径 (internal leaves, e.g. `docs/concepts/arbitrage.md`) or 复制链接 (external URLs)

## Install

The plugin ships inside this vault at `.obsidian/plugins/quant-wiki-navigation/`.
Enable it under Settings → Community plugins.

## Develop

    cd .obsidian/plugins/quant-wiki-navigation
    npm install
    npm run dev      # watch build
    npm run test     # parser + links unit tests (14 tests)

## Manual verification checklist

Run through after any behavior change:

- [ ] Left sidebar shows "章节导航" with all 12 top-level chapters (简介, 基本概念, 入门教程, 学术论文, 量化前沿, 量化百宝箱, AI+量化, 量化图书馆, 行业内幕, 求职专区, 独家资源, 其他入口)
- [ ] Chapters start collapsed (▸); clicking header toggles open/close (▾ ⇄ ▸)
- [ ] Click a leaf (no modifier) → opens in current pane
- [ ] Cmd/Ctrl+click → opens in new tab
- [ ] Shift+click → opens as split
- [ ] Click a leaf with `#anchor` (e.g. 量化百宝箱 → 回测与实盘交易) → scrolls to that heading
- [ ] Click external link (GitHub 仓库) → opens in system browser
- [ ] Manually open `docs/ai/index.md` → AI+量化 auto-expands and "简介" is highlighted
- [ ] Edit `docs/navigation.md` (add a line in 简介), save → sidebar updates within ~0.5s, other expanded chapters stay expanded
- [ ] Delete `docs/navigation.md` (move to trash) → view shows "Navigation file not found"; restore → auto re-renders
- [ ] Ribbon icon opens/focuses the view
- [ ] Command palette → "打开章节导航" → opens/focuses the view
- [ ] Toggle dark/light theme → colors remain correct
- [ ] Right-click a leaf → menu shows `复制文本` + `复制相对路径`; both copy to clipboard and show a Notice
- [ ] Right-click a chapter header or group title → menu shows only `复制文本`; right-click does NOT toggle expand/collapse
- [ ] Right-click an external link (GitHub 仓库) → menu shows `复制文本` + `复制链接` (URL)
