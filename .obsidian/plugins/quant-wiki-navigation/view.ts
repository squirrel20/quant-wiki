import { ItemView, Menu, Notice, TFile, WorkspaceLeaf, debounce } from 'obsidian';
import { NavNode, parse } from './parser';
import { renderTree, ExpandedSet } from './render';
import { toObsidianLinkText } from './links';

export const VIEW_TYPE = 'quant-wiki-navigation';
const NAV_FILE = 'docs/navigation.md';
const DOCS_PREFIX = 'docs/';

export class NavigationView extends ItemView {
  private expanded: ExpandedSet = new Set();
  private leafByHref: Map<string, HTMLElement[]> = new Map();
  private debouncedRebuild = debounce(() => this.rebuild(), 300, true);

  constructor(leaf: WorkspaceLeaf) { super(leaf); }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '章节导航'; }
  getIcon() { return 'list-tree'; }

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

  async onClose() {
    this.leafByHref.clear();
  }

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
      (node, evt) => this.handleContextMenu(node, evt),
    );

    this.highlightActive(this.app.workspace.getActiveFile());
  }

  private handleContextMenu(node: NavNode, evt: MouseEvent) {
    evt.preventDefault();
    evt.stopPropagation();

    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle('复制文本')
        .setIcon('clipboard-copy')
        .onClick(() => this.copyToClipboard(node.title, '已复制文本')),
    );

    if (node.href) {
      if (node.external) {
        menu.addItem((item) =>
          item
            .setTitle('复制链接')
            .setIcon('link')
            .onClick(() => this.copyToClipboard(node.href!, '已复制链接')),
        );
      } else {
        const projectPath = `${DOCS_PREFIX}${node.href}`;
        menu.addItem((item) =>
          item
            .setTitle('复制相对路径')
            .setIcon('file')
            .onClick(() => this.copyToClipboard(projectPath, '已复制路径')),
        );
      }
    }

    menu.showAtMouseEvent(evt);
  }

  private async copyToClipboard(text: string, successMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      new Notice(successMsg);
    } catch (err) {
      console.error('[qwn] clipboard write failed', err);
      new Notice('复制失败');
    }
  }

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

  private highlightActive(file: TFile | null) {
    const root = this.containerEl.children[1] as HTMLElement;
    root.querySelectorAll('.qwn-leaf.is-active').forEach((el) => el.classList.remove('is-active'));
    if (!file) return;

    const relative = file.path.startsWith('docs/') ? file.path.slice('docs/'.length) : null;
    if (!relative) return;

    // Gather all leaf elements whose href (with optional #anchor) resolves to this file.
    const matches: HTMLElement[] = [];
    const exact = this.leafByHref.get(relative);
    if (exact) matches.push(...exact);
    for (const [href, els] of this.leafByHref) {
      if (href === relative) continue;
      if (href.split('#')[0] === relative) matches.push(...els);
    }
    if (matches.length === 0) return;

    for (const el of matches) el.classList.add('is-active');

    // Expand ancestor chapter of the FIRST match (avoid thrashing toggles for the footer row).
    const first = matches[0];
    const chapterBody = first.closest('.qwn-chapter-body') as HTMLElement | null;
    if (chapterBody && chapterBody.style.display === 'none') {
      const chapter = chapterBody.parentElement as HTMLElement | null;
      const header = chapter?.querySelector('.qwn-chapter-header') as HTMLElement | null;
      header?.click();
    }

    first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
