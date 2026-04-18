export type NavNode = {
  title: string;
  href?: string;
  external?: boolean;
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
      current = { title: ch[1], children: [] };
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
