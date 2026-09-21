import type { BacklinkMention, WikilinkMatch } from './types';

export const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

export function extractWikilinks(content: string): WikilinkMatch[] {
  const matches: WikilinkMatch[] = [];
  const regex = new RegExp(WIKILINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      raw: match[0],
      targetNote: match[1]?.trim() || '',
      headingAnchor: match[2]?.trim(),
      alias: match[3]?.trim(),
      from: match.index,
      to: match.index + match[0].length,
    });
  }
  return matches;
}

export function normalizeNoteTitle(nameOrPath: string): string {
  const base = nameOrPath.split('/').pop()?.split('\\').pop() || nameOrPath;
  return base.replace(/\.md$/i, '').trim().toLowerCase();
}

export function findBacklinks(
  targetTitle: string,
  allNotes: Array<{ relative_path: string; title: string; content: string }>,
): BacklinkMention[] {
  const normalizedTarget = normalizeNoteTitle(targetTitle);
  const backlinks: BacklinkMention[] = [];
  for (const note of allNotes) {
    if (normalizeNoteTitle(note.title) === normalizedTarget) continue;
    const lines = note.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const link of extractWikilinks(lines[i])) {
        if (normalizeNoteTitle(link.targetNote) === normalizedTarget) {
          backlinks.push({
            sourcePath: note.relative_path,
            sourceTitle: note.title,
            snippet: lines[i].trim(),
            line: i + 1,
          });
        }
      }
    }
  }
  return backlinks;
}

export function refactorWikilinksOnRename(
  content: string,
  oldTitle: string,
  newTitle: string,
): { updatedContent: string; count: number } {
  const normalizedOld = normalizeNoteTitle(oldTitle);
  const cleanNewTitle = newTitle.replace(/\.md$/i, '').trim();
  let count = 0;
  const updatedContent = content.replace(
    new RegExp(WIKILINK_REGEX.source, 'g'),
    (match, target: string, heading: string | undefined, alias: string | undefined) => {
      if (normalizeNoteTitle(target) === normalizedOld) {
        count++;
        const headingPart = heading ? `#${heading}` : '';
        const aliasPart = alias ? `|${alias}` : '';
        return `[[${cleanNewTitle}${headingPart}${aliasPart}]]`;
      }
      return match;
    },
  );
  return { updatedContent, count };
}

export function findHeadingPosition(content: string, headingAnchor: string): number | null {
  const normalizedAnchor = headingAnchor.toLowerCase().trim();
  const lines = content.split('\n');
  let charOffset = 0;
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch && headingMatch[1].trim().toLowerCase() === normalizedAnchor) {
      return charOffset;
    }
    charOffset += line.length + 1;
  }
  return null;
}

export function findVaultEntry<T extends { relative_path: string; children?: T[] | null }>(
  entry: T | null,
  relative: string,
): T | null {
  if (!entry) return null;
  if (entry.relative_path === relative) return entry;
  for (const child of entry.children ?? []) {
    const found = findVaultEntry(child, relative);
    if (found) return found;
  }
  return null;
}

export function flattenVaultTree(
  entry: { is_dir: boolean; name: string; children?: unknown; relative_path: string; path: string },
): Array<{ name: string; path: string; relative_path: string; is_dir: boolean }> {
  const result: Array<{ name: string; path: string; relative_path: string; is_dir: boolean }> = [];
  const walk = (node: typeof entry) => {
    if (!node.is_dir && node.name.endsWith('.md')) {
      result.push({
        name: node.name,
        path: node.path,
        relative_path: node.relative_path,
        is_dir: false,
      });
    }
    const children = node.children as typeof entry[] | null | undefined;
    if (children) {
      for (const child of children) walk(child);
    }
  };
  walk(entry);
  return result;
}

export function titleFromPath(relativePath: string): string {
  return (relativePath.split('/').pop() || relativePath).replace(/\.md$/i, '');
}
