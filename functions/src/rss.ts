export type FeedItem = {
  title: string;
  link: string;
};

/** Minimal RSS 2.0 <item> extractor — no XML parser dependency needed for the handful of tags we care about. */
export function parseRssFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    if (title && link) {
      items.push({ title: decodeEntities(title), link: link.trim() });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return undefined;
  let value = match[1].trim();
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdataMatch) value = cdataMatch[1].trim();
  return value;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
