import assert from 'node:assert';
import {
  extractWikilinks,
  findBacklinks,
  refactorWikilinksOnRename,
  findHeadingPosition,
  normalizeNoteTitle,
} from './wikilinks.ts';

console.log('Running wikilinks self-test...');

// 1. Basic wikilink
const basic = extractWikilinks('Check [[Architecture]] for details.');
assert.strictEqual(basic.length, 1);
assert.strictEqual(basic[0].targetNote, 'Architecture');
assert.strictEqual(basic[0].alias, undefined);
assert.strictEqual(basic[0].headingAnchor, undefined);

// 2. Alias
const aliased = extractWikilinks('Read [[Architecture|System Design]] now.');
assert.strictEqual(aliased.length, 1);
assert.strictEqual(aliased[0].targetNote, 'Architecture');
assert.strictEqual(aliased[0].alias, 'System Design');

// 3. Heading anchor
const anchored = extractWikilinks('See [[Architecture#Editor Engine]] here.');
assert.strictEqual(anchored.length, 1);
assert.strictEqual(anchored[0].targetNote, 'Architecture');
assert.strictEqual(anchored[0].headingAnchor, 'Editor Engine');

// 4. Combined heading + alias
const combo = extractWikilinks('Look at [[Architecture#Editor Engine|Engine Specs]].');
assert.strictEqual(combo.length, 1);
assert.strictEqual(combo[0].targetNote, 'Architecture');
assert.strictEqual(combo[0].headingAnchor, 'Editor Engine');
assert.strictEqual(combo[0].alias, 'Engine Specs');

// 5. Backlink extraction
const allNotes = [
  {
    path: '/vault/Note A.md',
    title: 'Note A',
    content: 'Introduction to [[Architecture]] and [[Daily Log]].',
  },
  {
    path: '/vault/Note B.md',
    title: 'Note B',
    content: 'Follow up on [[Architecture#Editor Engine|The Engine]].',
  },
  {
    path: '/vault/Architecture.md',
    title: 'Architecture',
    content: '# Architecture\n## Editor Engine\nSelf reference [[Architecture]].',
  },
];

const backlinks = findBacklinks('Architecture', allNotes);
assert.strictEqual(backlinks.length, 2);
assert.strictEqual(backlinks[0].sourceTitle, 'Note A');
assert.strictEqual(backlinks[1].sourceTitle, 'Note B');

// 6. Rename refactoring
const noteContent = 'Links: [[Old Name]], [[Old Name|Alias Text]], and [[Old Name#Heading]].';
const { updatedContent, count } = refactorWikilinksOnRename(noteContent, 'Old Name', 'New Name');
assert.strictEqual(count, 3);
assert.strictEqual(
  updatedContent,
  'Links: [[New Name]], [[New Name|Alias Text]], and [[New Name#Heading]].'
);

// 7. Heading position lookup
const doc = '# Header 1\nSome text\n\n## Subheading\nMore text';
const pos = findHeadingPosition(doc, 'Subheading');
// 8. Title normalization
assert.strictEqual(normalizeNoteTitle('Some Note.md'), 'some note');
assert.strictEqual(normalizeNoteTitle('/path/to/Deep Note.MD'), 'deep note');

console.log('✓ All wikilink unit checks passed successfully!');
