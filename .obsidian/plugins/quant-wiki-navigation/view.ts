import { ItemView, TFile, WorkspaceLeaf, debounce } from 'obsidian';
import { NavNode, parse } from './parser';
import { renderTree, ExpandedSet } from './render';
import { toObsidianLinkText } from './links';

export const VIEW_TYPE = 'quant-wiki-navigation';
const NAV_FILE = 'docs/navigation.md';

export class NavigationView extends ItemView {
  private expanded: ExpandedSet = new Set();
  private leafByHref: Map<string, HTMLElement> = new Map();
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
}
