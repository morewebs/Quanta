export type FontMode = 'auto' | 'sans' | 'serif' | 'mono';
export type ThemeMode = 'dark' | 'light';

export interface VaultEntry {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  children?: VaultEntry[] | null;
}

export interface NoteFile {
  relative_path: string;
  title: string;
  content: string;
}

export interface WikilinkMatch {
  raw: string;
  targetNote: string;
  headingAnchor?: string;
  alias?: string;
  from: number;
  to: number;
}

export interface BacklinkMention {
  sourcePath: string;
  sourceTitle: string;
  snippet: string;
  line: number;
}

export interface ChatOption {
  id: number;
  name: string;
  kind: string;
}

export interface StorageTarget {
  kind: 'saved_messages' | 'chat';
  id?: number;
  name?: string;
}

export interface AppConfig {
  api_id: number | null;
  api_hash: string | null;
  vault_path: string | null;
  storage: StorageTarget;
  theme: ThemeMode | string;
}

export interface AuthStatus {
  configured: boolean;
  authorized: boolean;
  name: string | null;
}

export interface SignInResult {
  ok: boolean;
  needs_password: boolean;
  password_hint: string | null;
  name: string | null;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'waiting' | 'error' | string;
  detail?: string | null;
}
