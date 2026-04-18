export type NavNode = {
  title: string;
  href?: string;
  external: boolean;
  children: NavNode[];
};

const CHAPTER_RE = /^##\s+(.+?)\s*$/;
const GROUP_RE   = /^(\s*)-\s*\*\*(.+?)\*\*\s*$/;
const LINK_GLOBAL_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function mkLeaf(title: string, href: string): NavNode {
  return {
    title: title.trim(),
    href: href.trim(),
    external: /^https?:\/\//i.test(href),
    children: [],
  };
}

export function parse(md: string): NavNode[] {
  const chapters: NavNode[] = [];
  let current: NavNode | null = null;
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
  }

  return chapters;
}
