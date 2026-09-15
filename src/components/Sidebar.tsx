import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  FolderSync,
  PanelLeftClose,
  Search,
  Settings,
} from 'lucide-react';
import { VaultEntry } from '../types/vault';

interface SidebarProps {
  vaultName: string;
  fileTree: VaultEntry | null;
  activeNotePath: string | null;
  onSelectNote: (path: string) => void;
  onCreateNote: (folderPath?: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onRenamePath: (oldPath: string, newPath: string) => void;
  onDeletePath: (path: string) => void;
  onOpenVault: () => void;
  onOpenSwitcher: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

interface TreeItemProps {
  entry: VaultEntry;
  depth: number;
  activeNotePath: string | null;
  onSelectNote: (path: string) => void;
  onCreateNote: (folderPath?: string) => void;
  onRenamePath: (oldPath: string, newPath: string) => void;
  onDeletePath: (path: string) => void;
}

const TreeItemComponent: React.FC<TreeItemProps> = ({
  entry,
  depth,
  activeNotePath,
  onSelectNote,
  onCreateNote,
  onRenamePath,
  onDeletePath,
}) => {
  const containsActive = Boolean(
    activeNotePath &&
      (activeNotePath === entry.path || activeNotePath.startsWith(entry.path + '/') || activeNotePath.startsWith(entry.path + '\\'))
  );
  const [isOpen, setIsOpen] = useState(containsActive);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(
    entry.is_dir ? entry.name : entry.name.replace(/\.md$/i, '')
  );

  useEffect(() => {
    if (containsActive) {
      setIsOpen(true);
    }
  }, [containsActive]);

  const isSelected = !entry.is_dir && entry.path === activeNotePath;

  const handleRenameSubmit = () => {
    setIsEditing(false);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === entry.name.replace(/\.md$/i, '')) return;

    const parent = entry.path.substring(
      0,
      Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\'))
    );
    const separator = entry.path.includes('\\') ? '\\' : '/';
    const newFileName = entry.is_dir ? trimmed : (trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`);
    const newPath = parent ? `${parent}${separator}${newFileName}` : newFileName;

    onRenamePath(entry.path, newPath);
  };

  if (entry.is_dir) {
    return (
      <div className="select-none">
        <div
          className="group flex items-center justify-between px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 8 + 6}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center space-x-1.5 truncate">
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            )}
            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={editName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="bg-zinc-950 border border-zinc-700 rounded px-1 text-xs text-zinc-100 focus:outline-none w-28"
              />
            ) : (
              <bdi className="truncate font-medium">{entry.name}</bdi>
            )}
          </div>

          <div
            className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onCreateNote(entry.path)}
              title="New note in folder"
              className="p-0.5 hover:text-sky-400"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              title="Rename folder"
              className="p-0.5 hover:text-zinc-200"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => onDeletePath(entry.path)}
              title="Delete folder"
              className="p-0.5 hover:text-rose-400"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {isOpen && entry.children && (
          <div className="ml-2.5 pl-1.5 border-l border-zinc-900/80">
            {entry.children.map((child) => (
              <TreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                activeNotePath={activeNotePath}
                onSelectNote={onSelectNote}
                onCreateNote={onCreateNote}
                onRenamePath={onRenamePath}
                onDeletePath={onDeletePath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Note file
  const displayTitle = entry.name.replace(/\.md$/i, '');

  return (
    <div
      className={`group flex items-center justify-between px-2 py-1 rounded-r text-xs cursor-pointer select-none transition-colors ${
        isSelected
          ? 'bg-zinc-900 text-zinc-100 font-medium border-l-2 border-sky-500'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
      }`}
      style={{ paddingLeft: isSelected ? `${depth * 8 + 10}px` : `${depth * 8 + 12}px` }}
      onClick={() => onSelectNote(entry.path)}
    >
      <div className="flex items-center space-x-2 truncate">
        <FileText
          className={`w-3.5 h-3.5 shrink-0 ${
            isSelected ? 'text-sky-400' : 'text-zinc-500 group-hover:text-zinc-400'
          }`}
        />
        {isEditing ? (
          <input
            type="text"
            autoFocus
            value={editName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="bg-zinc-950 border border-zinc-700 rounded px-1 text-xs text-zinc-100 focus:outline-none w-32"
          />
        ) : (
          <bdi className="truncate">{displayTitle}</bdi>
        )}
      </div>

      <div
        className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsEditing(true)}
          title="Rename note"
          className="p-0.5 hover:text-zinc-200"
        >
          <Edit2 className="w-2.5 h-2.5 text-zinc-400" />
        </button>
        <button
          onClick={() => onDeletePath(entry.path)}
          title="Delete note"
          className="p-0.5 hover:text-rose-400"
        >
          <Trash2 className="w-2.5 h-2.5 text-zinc-400 hover:text-rose-400" />
        </button>
      </div>
    </div>
  );
};

const TreeItem = React.memo(TreeItemComponent);

const SidebarComponent: React.FC<SidebarProps> = ({
  vaultName,
  fileTree,
  activeNotePath,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onRenamePath,
  onDeletePath,
  onOpenVault,
  onOpenSwitcher,
  onToggleSidebar,
  onOpenSettings,
}) => {
  return (
    <aside className="w-64 h-full bg-zinc-950 border-r border-zinc-900 flex flex-col select-none shrink-0">
      {/* Vault Title Bar */}
      <div className="h-10 border-b border-zinc-900 px-3 flex items-center justify-between text-xs font-medium text-zinc-200 bg-zinc-950">
        <div
          onClick={onOpenVault}
          className="flex items-center space-x-2 truncate cursor-pointer hover:text-zinc-100 group"
          title="Switch Vault Folder"
        >
          <FolderSync className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400 transition-colors" />
          <bdi className="truncate font-semibold tracking-wide text-zinc-300 group-hover:text-zinc-100">
            {vaultName || 'Quanta Vault'}
          </bdi>
        </div>

        <div className="flex items-center space-x-1 text-zinc-400">
          <button
            onClick={() => onCreateNote()}
            title="New Note (Ctrl+N)"
            className="p-1 rounded hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onCreateFolder()}
            title="New Folder"
            className="p-1 rounded hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleSidebar}
            title="Collapse Sidebar (Ctrl+\)"
            className="p-1 rounded hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Search trigger button */}
      <div className="p-2 border-b border-zinc-900">
        <button
          onClick={onOpenSwitcher}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded border border-zinc-900 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <span>Quick search...</span>
          </div>
          <kbd className="text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded px-1 bg-zinc-950">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {fileTree?.children && fileTree.children.length > 0 ? (
          fileTree.children.map((child) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={0}
              activeNotePath={activeNotePath}
              onSelectNote={onSelectNote}
              onCreateNote={onCreateNote}
              onRenamePath={onRenamePath}
              onDeletePath={onDeletePath}
            />
          ))
        ) : (
          <div className="py-12 text-center text-xs text-zinc-600 px-4">
            No notes found. Click + to create a note.
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="h-8 border-t border-zinc-900 px-3 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center space-x-2">
          <span className="text-zinc-400 font-medium">Quanta</span>
          <span className="text-[10px] text-zinc-600">v1.0.0</span>
        </div>
        <button
          onClick={onOpenSettings}
          title="Settings (Ctrl + ,)"
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

export const Sidebar = React.memo(SidebarComponent);
