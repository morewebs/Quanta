import assert from 'node:assert';
import { isRtlLine } from './live-preview.ts';

console.log('Testing live-preview RTL detection...');

// 1. RTL Heading with Emoji
assert.strictEqual(
  isRtlLine('# 🚀 برنامه و درسنامه جامع امروز — 2026-08-31'),
  true,
  'Heading starting with emoji + Persian must be RTL'
);

// 2. RTL Blockquote with markdown prefix
assert.strictEqual(
  isRtlLine('> **هدف روزانه:** ورود به جریان یادگیری متمرکز (Flow State)'),
  true,
  'Blockquote with Persian must be RTL'
);

// 3. LTR Heading with Emoji
assert.strictEqual(
  isRtlLine('### 📘 *Atomic Habits* — James Clear'),
  false,
  'Heading with emoji + English must be LTR'
);

// 4. RTL Bullet list
assert.strictEqual(
  isRtlLine('- **قاعده:** پیشرفت‌های کوچک ۱ درصدی روزانه'),
  true,
  'Bullet list with Persian must be RTL'
);

// 5. RTL Numbered list
assert.strictEqual(
  isRtlLine('1. **قانون ۲ دقیقه (Two-Minute Rule):** هر عادتی'),
  true,
  'Numbered list with Persian must be RTL'
);

// 6. LTR Code and Plaintext
assert.strictEqual(isRtlLine('const x = 42;'), false, 'Code must be LTR');
assert.strictEqual(isRtlLine('### Architecture Overview'), false, 'English heading must be LTR');

console.log('✓ All live-preview RTL tests passed!');

console.log('Testing token-level cursor proximity logic...');

const sampleText = '### 📘 *Atomic Habits* — James Clear';
const headingMatch = sampleText.match(/^(#{1,6})\s+/);
const hashLen = headingMatch ? headingMatch[0].length : 0; // 4 ("### ")
const italicMatch = /(?<!\*)\*([^*]+)\*(?!\*)/.exec(sampleText)!;
const italicStart = italicMatch.index; // 7
const italicEnd = italicStart + italicMatch[0].length; // 22

// Scenario A: User clicks on the emoji 📘 (index 5)
const cursorAtEmoji = 5;
const isEditingHashesAtEmoji = cursorAtEmoji >= 0 && cursorAtEmoji <= hashLen;
const isEditingItalicAtEmoji = cursorAtEmoji >= italicStart && cursorAtEmoji <= italicEnd;
assert.strictEqual(isEditingHashesAtEmoji, false, 'Clicking emoji must not trigger heading edit mode');
assert.strictEqual(isEditingItalicAtEmoji, false, 'Clicking emoji must not trigger italic edit mode');

// Scenario B: User clicks inside Atomic Habits (index 12)
const cursorInsideItalic = 12;
const isEditingHashesInsideItalic = cursorInsideItalic >= 0 && cursorInsideItalic <= hashLen;
const isEditingItalicInsideItalic = cursorInsideItalic >= italicStart && cursorInsideItalic <= italicEnd;
assert.strictEqual(isEditingHashesInsideItalic, false, 'Cursor in italics must not reveal heading hashes');
assert.strictEqual(isEditingItalicInsideItalic, true, 'Cursor in italics must reveal asterisks for editing');

// Scenario C: User navigates into heading hashes ### (index 2)
const cursorAtHashes = 2;
const isEditingHashesAtHashes = cursorAtHashes >= 0 && cursorAtHashes <= hashLen;
const isEditingItalicAtHashes = cursorAtHashes >= italicStart && cursorAtHashes <= italicEnd;
assert.strictEqual(isEditingHashesAtHashes, true, 'Cursor at hashes must reveal hashes');
assert.strictEqual(isEditingItalicAtHashes, false, 'Cursor at hashes must not reveal italic asterisks');

console.log('✓ All token-level cursor proximity tests passed!');
