import { describe, expect, it } from 'vitest';
import {
  extractWikilinks,
  findBacklinks,
  normalizeNoteTitle,
  refactorWikilinksOnRename,
} from './wikilinks';

describe('wikilinks', () => {
  it('parses target, heading, and alias', () => {
    const links = extractWikilinks('See [[Architecture#Editor|the editor]]');
    expect(links).toHaveLength(1);
    expect(links[0].targetNote).toBe('Architecture');
    expect(links[0].headingAnchor).toBe('Editor');
    expect(links[0].alias).toBe('the editor');
  });

  it('finds backlinks from other notes', () => {
    const mentions = findBacklinks('Architecture', [
      { relative_path: 'Welcome.md', title: 'Welcome', content: 'Read [[Architecture]] today.' },
      { relative_path: 'Architecture.md', title: 'Architecture', content: 'self [[Architecture]]' },
    ]);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].sourcePath).toBe('Welcome.md');
  });

  it('refactors inbound links on rename', () => {
    const { updatedContent, count } = refactorWikilinksOnRename(
      'See [[Old Name#H|alias]] and [[other]]',
      'Old Name',
      'New Name',
    );
    expect(count).toBe(1);
    expect(updatedContent).toContain('[[New Name#H|alias]]');
    expect(normalizeNoteTitle('New Name.md')).toBe('new name');
  });
});
