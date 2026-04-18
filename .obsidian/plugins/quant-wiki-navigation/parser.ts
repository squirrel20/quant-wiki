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
