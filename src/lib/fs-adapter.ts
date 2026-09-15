import { VaultEntry } from '../types/vault';

// Detect if running inside Tauri
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

// In-memory mock storage for browser testing / demo
const mockStorageKey = 'quanta_mock_vault';
const defaultMockNotes: Record<string, string> = {
  '/QuantaVault/Welcome to Quanta.md': `# Welcome to Quanta

Quanta is a minimalist, local-first notes environment built for extreme focus and zero feature-fatigue.

## Core Philosophy
- **Anti-AI Slop**: No bubbly neon cards, no floating gradients. Just crisp, high-density [[Architecture|precision UI]].
- **Local-first**: Markdown on your disk. You own every byte.
- **Fast Navigation**: Press \`Ctrl+K\` (or \`Cmd+K\`) to instantly switch notes.

## Live Preview Showcase
Live Preview formats markdown inline while concealing markup until your cursor enters:
- Check out **bold text**, *italics*, and \`inline code\`.
- Interactive GFM task lists:
  - [x] Create Tauri desktop foundation
  - [x] Configure CodeMirror 6 Live Preview
  - [ ] Master the [[Keyboard Shortcuts#Quick Switcher|command workflow]]
  - [ ] Write daily thoughts in [[Daily Log]]

## Wikilinks & Backlinks
Wikilinks connect notes bidirectionally:
- Link to an existing note: [[Architecture]]
- Link with a custom alias: [[Architecture|Technical Design]]
- Link to a specific heading: [[Architecture#Editor Engine]]
- Link to an uncreated note: [[Project Roadmap]] (notice the dimmed styling — clicking this will instantly create the note!)

Scroll to the bottom of this note to see **Linked References**!
`,
  '/QuantaVault/Architecture.md': `# Architecture

Quanta is built with a dual-layer architecture:

## Backend Core
- Rust desktop runtime via Tauri v2
- Direct local filesystem access with atomic saves
- Standard UTF-8 \`.md\` compatibility with Obsidian and Git

## Editor Engine
CodeMirror 6 with custom extensions:
- Live Preview view plugins
- Inline wikilink decorator
- Dynamic \`[[\` autocomplete

Refer back to [[Welcome to Quanta]] anytime.
`,
  '/QuantaVault/Daily Log.md': `# Daily Log

## Today
- Initialized Quanta project
- Verified [[Architecture]] and live preview
- Documented in [[Welcome to Quanta]]
`
};

function getMockFiles(): Record<string, string> {
  const saved = localStorage.getItem(mockStorageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  localStorage.setItem(mockStorageKey, JSON.stringify(defaultMockNotes));
  return defaultMockNotes;
}

function saveMockFiles(files: Record<string, string>) {
  localStorage.setItem(mockStorageKey, JSON.stringify(files));
}

function buildMockTree(files: Record<string, string>): VaultEntry {
  const root: VaultEntry = {
    name: 'QuantaVault',
    path: '/QuantaVault',
    relative_path: '',
    is_dir: true,
    children: []
  };

  for (const path of Object.keys(files)) {
    const filename = path.split('/').pop() || 'Untitled.md';
    const rel = filename;
    root.children?.push({
      name: filename,
      path: path,
      relative_path: rel,
      is_dir: false
    });
  }

  root.children?.sort((a, b) => a.name.localeCompare(b.name));
  return root;
}

export async function pickVaultFolder(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Quanta Vault Folder'
      });
      return typeof selected === 'string' ? selected : null;
    } catch (err) {
      console.error('Failed to open dialog via Tauri:', err);
      return null;
    }
  } else {
    // Browser fallback
    return '/QuantaVault';
  }
}

export async function loadVaultTree(vaultPath: string): Promise<VaultEntry> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<VaultEntry>('read_vault_tree', { vaultPath });
  } else {
    const files = getMockFiles();
    return buildMockTree(files);
  }
}

export async function readNoteFile(filePath: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('read_note_file', { filePath });
  } else {
    const files = getMockFiles();
    return files[filePath] ?? '';
  }
}

export async function writeNoteFile(filePath: string, content: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_note_file', { filePath, content });
  } else {
    const files = getMockFiles();
    files[filePath] = content;
    saveMockFiles(files);
  }
}

export async function createNoteFile(filePath: string, content = ''): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('create_note_file', { filePath, content });
  } else {
    const files = getMockFiles();
    files[filePath] = content;
    saveMockFiles(files);
  }
}

export async function createVaultDir(dirPath: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('create_vault_dir', { dirPath });
  }
}

export async function renameVaultPath(oldPath: string, newPath: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('rename_vault_path', { oldPath, newPath });
  } else {
    const files = getMockFiles();
    if (files[oldPath] !== undefined) {
      files[newPath] = files[oldPath];
      delete files[oldPath];
      saveMockFiles(files);
    }
  }
}

export async function deleteVaultPath(path: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_vault_path', { path });
  } else {
    const files = getMockFiles();
    delete files[path];
    saveMockFiles(files);
  }
}

export function flattenVaultTree(entry: VaultEntry): VaultEntry[] {
  const result: VaultEntry[] = [];
  if (!entry.is_dir && entry.name.endsWith('.md')) {
    result.push(entry);
  }
  if (entry.children) {
    for (const child of entry.children) {
      result.push(...flattenVaultTree(child));
    }
  }
  return result;
}
