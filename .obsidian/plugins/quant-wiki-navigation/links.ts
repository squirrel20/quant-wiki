export function toObsidianLinkText(href: string): string {
  const [pathPart, anchor] = href.split('#', 2);
  const noExt = pathPart.replace(/\.md$/, '');
  const full = `docs/${noExt}`;
  return anchor ? `${full}#${anchor}` : full;
}
