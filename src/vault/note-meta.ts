import { extractWikilinks } from './wikilinks';

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export function extractHeadings(content: string): Heading[] {
  const out: Heading[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) out.push({ level: match[1].length, text: match[2].trim(), line: i + 1 });
  }
  return out;
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const regex = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1]);
  }
  return [...tags];
}

export function extractOutgoing(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of extractWikilinks(content)) {
    const key = link.targetNote.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link.targetNote);
  }
  return out;
}
