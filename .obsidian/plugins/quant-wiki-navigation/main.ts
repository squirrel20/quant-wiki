import { Plugin } from 'obsidian';

export default class QuantWikiNavigationPlugin extends Plugin {
  async onload() {
    console.log('[quant-wiki-navigation] loaded');
  }
  async onunload() {
    console.log('[quant-wiki-navigation] unloaded');
  }
}
