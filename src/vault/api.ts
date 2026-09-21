import { invoke } from '@tauri-apps/api/core';
import type {
  AppConfig,
  AuthStatus,
  ChatOption,
  SignInResult,
  StorageTarget,
  VaultEntry,
} from './types';

const isTauri = () =>
  typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export async function readVaultTree(): Promise<VaultEntry> {
  if (!isTauri()) {
    return {
      name: 'Vault',
      path: '',
      relative_path: '',
      is_dir: true,
      children: [
        {
          name: 'Welcome.md',
          path: 'Welcome.md',
          relative_path: 'Welcome.md',
          is_dir: false,
        },
      ],
    };
  }
  return invoke('read_vault_tree');
}

export async function readNote(relativePath: string): Promise<string> {
  if (!isTauri()) return `# ${relativePath}\n`;
  return invoke('read_note_file', { relativePath });
}

export async function writeNote(relativePath: string, content: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('write_note_file', { relativePath, content });
}

export async function createNote(relativePath: string, content = ''): Promise<void> {
  if (!isTauri()) return;
  await invoke('create_note_file', { relativePath, content });
}

export async function createDir(relativePath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('create_vault_dir', { relativePath });
}

export async function renamePath(oldRelative: string, newRelative: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('rename_vault_path', { oldRelative, newRelative });
}

export async function deletePath(relativePath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('delete_vault_path', { relativePath });
}

export async function getConfig(): Promise<AppConfig> {
  if (!isTauri()) {
    return {
      api_id: null,
      api_hash: null,
      vault_path: null,
      storage: { kind: 'saved_messages' },
      theme: 'dark',
    };
  }
  return invoke('get_config');
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  if (!isTauri()) return config;
  return invoke('save_config', { config });
}

export async function tgStatus(): Promise<AuthStatus> {
  if (!isTauri()) return { configured: false, authorized: false, name: null };
  return invoke('tg_status');
}

export async function tgConnect(): Promise<AuthStatus> {
  return invoke('tg_connect');
}

export async function tgRequestCode(phone: string): Promise<void> {
  await invoke('tg_request_code', { phone });
}

export async function tgSignIn(code: string): Promise<SignInResult> {
  return invoke('tg_sign_in', { code });
}

export async function tgCheckPassword(password: string): Promise<SignInResult> {
  return invoke('tg_check_password', { password });
}

export async function tgListChats(): Promise<ChatOption[]> {
  return invoke('tg_list_chats');
}

export async function tgSetStorage(storage: StorageTarget): Promise<AppConfig> {
  return invoke('tg_set_storage', { storage });
}

export async function tgSyncNow(): Promise<void> {
  await invoke('tg_sync_now');
}

export async function tgStartUpdates(): Promise<void> {
  await invoke('tg_start_updates');
}

export async function revealInOs(relativePath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('reveal_in_os', { relativePath });
}

export async function openInOs(relativePath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('open_in_os', { relativePath });
}

export async function pickVaultFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false, title: 'Open vault folder' });
  if (typeof selected !== 'string') return null;
  await invoke('pick_vault_folder', { path: selected });
  return selected;
}
