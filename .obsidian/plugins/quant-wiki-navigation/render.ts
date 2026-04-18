import { NavNode } from './parser';

export type ExpandedSet = Set<string>;

/** Render nav tree into `root`. Returns element list keyed by href for active tracking. */
export function renderTree(
  root: HTMLElement,
  nodes: NavNode[],
  expanded: ExpandedSet,
  onToggle: (chapterTitle: string, willExpand: boolean) => void,
  onLeafClick: (node: NavNode, evt: MouseEvent) => void,
): Map<string, HTMLElement> {
  root.empty();
  const leafByHref = new Map<string, HTMLElement>();
  const list = root.createDiv({ cls: 'qwn-tree' });

  for (const chapter of nodes) {
    const chapterEl = list.createDiv({ cls: 'qwn-chapter' });
    const header = chapterEl.createDiv({ cls: 'qwn-chapter-header' });
    const triangle = header.createSpan({ cls: 'qwn-triangle', text: '▸' });
    header.createSpan({ cls: 'qwn-chapter-title', text: chapter.title });

    const body = chapterEl.createDiv({ cls: 'qwn-chapter-body' });
    const isOpen = expanded.has(chapter.title);
    body.style.display = isOpen ? '' : 'none';
    triangle.setText(isOpen ? '▾' : '▸');

    header.addEventListener('click', () => {
      const nowOpen = body.style.display === 'none';
      body.style.display = nowOpen ? '' : 'none';
      triangle.setText(nowOpen ? '▾' : '▸');
      onToggle(chapter.title, nowOpen);
    });

    renderChildren(body, chapter.children, 0, leafByHref, onLeafClick);
  }

  return leafByHref;
}

function renderChildren(
  parent: HTMLElement,
  nodes: NavNode[],
  depth: number,
  leafByHref: Map<string, HTMLElement>,
  onLeafClick: (node: NavNode, evt: MouseEvent) => void,
) {
  for (const n of nodes) {
    if (n.href) {
      const leaf = parent.createDiv({ cls: 'qwn-leaf', text: n.title });
      leaf.style.paddingLeft = `${12 + depth * 12}px`;
      leaf.addEventListener('click', (evt) => onLeafClick(n, evt));
      leafByHref.set(n.href, leaf);
    } else {
      const group = parent.createDiv({ cls: 'qwn-group' });
      const gt = group.createDiv({ cls: 'qwn-group-title', text: n.title });
      gt.style.paddingLeft = `${12 + depth * 12}px`;
      renderChildren(group, n.children, depth + 1, leafByHref, onLeafClick);
    }
  }
}
