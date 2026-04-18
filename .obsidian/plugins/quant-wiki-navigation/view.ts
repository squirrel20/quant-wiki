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
