export interface VaultEntry {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  children?: VaultEntry[];
}

export interface NoteFile {
  path: string;
  relative_path: string;
  title: string;
  content: string;
  modified?: number;
}

export interface WikilinkMatch {
  raw: string;
  targetNote: string;
  alias?: string;
  headingAnchor?: string;
  from: number;
  to: number;
}

export interface BacklinkMention {
  sourcePath: string;
  sourceTitle: string;
  snippet: string;
  line: number;
}

export interface VaultState {
  vaultPath: string | null;
  vaultName: string;
  fileTree: VaultEntry | null;
  allNotes: NoteFile[];
  activeNote: NoteFile | null;
  isSaving: boolean;
  dirty: boolean;
}

export type FontMode = 'auto' | 'sans' | 'serif' | 'mono';
