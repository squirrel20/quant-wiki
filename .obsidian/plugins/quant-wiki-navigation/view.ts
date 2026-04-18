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
