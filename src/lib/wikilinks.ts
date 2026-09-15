import type { WikilinkMatch, BacklinkMention } from '../types/vault.ts';

// Match: [[Target Note]] or [[Target Note#Heading]] or [[Target Note|Custom Alias]] or [[Target Note#Heading|Custom Alias]]
export const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Parses all wikilinks in a markdown document with start and end character positions.
 */
export function extractWikilinks(content: string): WikilinkMatch[] {
  const matches: WikilinkMatch[] = [];
  const regex = new RegExp(WIKILINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[0];
    const targetNote = match[1]?.trim() || '';
    const headingAnchor = match[2]?.trim();
    const alias = match[3]?.trim();

    matches.push({
      raw,
      targetNote,
      headingAnchor,
      alias,
      from: match.index,
      to: match.index + raw.length,
    });
  }

  return matches;
}

/**
 * Normalizes note titles for case-insensitive matching without extension.
 */
export function normalizeNoteTitle(nameOrPath: string): string {
  const base = nameOrPath.split('/').pop()?.split('\\').pop() || nameOrPath;
  return base.replace(/\.md$/i, '').trim().toLowerCase();
}

/**
 * Checks if a note exists in the vault given a target note title.
 */
export function isNoteResolved(targetTitle: string, existingNoteTitles: Set<string>): boolean {
  return existingNoteTitles.has(normalizeNoteTitle(targetTitle));
}

/**
 * Finds all incoming backlinks from all notes in the vault pointing to targetTitle.
 */
export function findBacklinks(
  targetTitle: string,
  allNotes: Array<{ path: string; title: string; content: string }>
): BacklinkMention[] {
  const normalizedTarget = normalizeNoteTitle(targetTitle);
  const backlinks: BacklinkMention[] = [];

  for (const note of allNotes) {
    // Skip self-references
    if (normalizeNoteTitle(note.title) === normalizedTarget) {
      continue;
    }

    const lines = note.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const links = extractWikilinks(line);
      for (const link of links) {
        if (normalizeNoteTitle(link.targetNote) === normalizedTarget) {
          backlinks.push({
            sourcePath: note.path,
            sourceTitle: note.title,
            snippet: line.trim(),
            line: i + 1,
          });
        }
      }
    }
  }

  return backlinks;
}

/**
 * Refactors all wikilinks in a note when a note is renamed across the vault.
 * Replaces [[oldTitle...]] with [[newTitle...]] preserving alias and heading.
 */
export function refactorWikilinksOnRename(
  content: string,
  oldTitle: string,
  newTitle: string
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
    }
  );

  return { updatedContent, count };
}

/**
 * Resolves the character position or line of a heading anchor in a target note.
 */
export function findHeadingPosition(content: string, headingAnchor: string): number | null {
  const normalizedAnchor = headingAnchor.toLowerCase().trim();
  const lines = content.split('\n');
  let charOffset = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch && headingMatch[1].trim().toLowerCase() === normalizedAnchor) {
      return charOffset;
    }
    charOffset += line.length + 1; // +1 for newline
  }

  return null;
}
