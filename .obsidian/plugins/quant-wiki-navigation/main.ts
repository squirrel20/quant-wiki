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
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (reveal) workspace.revealLeaf(leaf);
  }
}
