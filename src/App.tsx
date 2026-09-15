import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VaultEntry, NoteFile, FontMode } from './types/vault';
import {
  pickVaultFolder,
  loadVaultTree,
  readNoteFile,
  writeNoteFile,
  createNoteFile,
  createVaultDir,
  renameVaultPath,
  deleteVaultPath,
  flattenVaultTree,
} from './lib/fs-adapter';
import {
  findBacklinks,
  refactorWikilinksOnRename,
  normalizeNoteTitle,
} from './lib/wikilinks';
import { Sidebar } from './components/Sidebar';
import { Editor } from './editor/Editor';
import { QuickSwitcher } from './components/QuickSwitcher';
import { SettingsModal } from './components/SettingsModal';
import { PanelLeftOpen } from 'lucide-react';

const LAST_VAULT_KEY = 'quanta_last_vault_path';

export const App: React.FC = () => {
  const [vaultPath, setVaultPath] = useState<string | null>(() => {
    return localStorage.getItem(LAST_VAULT_KEY) || null;
  });
  const [vaultName, setVaultName] = useState<string>('Quanta Vault');
  const [fileTree, setFileTree] = useState<VaultEntry | null>(null);
  const [allNotes, setAllNotes] = useState<NoteFile[]>([]);
  const [activeNote, setActiveNote] = useState<NoteFile | null>(null);
  const [targetHeadingAnchor, setTargetHeadingAnchor] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fontMode, setFontMode] = useState<FontMode>(() => {
    return (localStorage.getItem('quanta_font_mode') as FontMode) || 'auto';
  });
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    return localStorage.getItem('quanta_full_width') === 'true';
  });
  const [isRtlAutoDetect, setIsRtlAutoDetect] = useState<boolean>(() => {
    const stored = localStorage.getItem('quanta_rtl_detect');
    return stored !== null ? stored === 'true' : true;
  });

  const handleFontModeChange = (mode: FontMode) => {
    setFontMode(mode);
    localStorage.setItem('quanta_font_mode', mode);
  };

  const handleToggleFullWidth = () => {
    setIsFullWidth((prev) => {
      const next = !prev;
      localStorage.setItem('quanta_full_width', String(next));
      return next;
    });
  };

  const handleToggleRtlAutoDetect = () => {
    setIsRtlAutoDetect((prev) => {
      const next = !prev;
      localStorage.setItem('quanta_rtl_detect', String(next));
      return next;
    });
  };

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeNoteRef = useRef<NoteFile | null>(activeNote);
  activeNoteRef.current = activeNote;

  // Load vault tree and read note contents into memory lazily
  const refreshVault = useCallback(
    async (currentVaultPath?: string) => {
      const p = currentVaultPath || vaultPath || '/QuantaVault';
      try {
        const tree = await loadVaultTree(p);
        setFileTree(tree);

        const name = p.split(/[/\\]/).filter(Boolean).pop() || 'Quanta Vault';
        setVaultName(name);

        // Map note metadata instantly without blocking on disk reads
        const flatFiles = flattenVaultTree(tree);
        const noteMetaList: NoteFile[] = flatFiles.map((entry) => ({
          path: entry.path,
          relative_path: entry.relative_path,
          title: entry.name.replace(/\.md$/i, ''),
          content: '',
        }));

        setAllNotes(noteMetaList);

        // Open active note or the first note lazily
        const targetPath = activeNoteRef.current?.path || (noteMetaList.length > 0 ? noteMetaList[0].path : null);
        if (targetPath) {
          const content = await readNoteFile(targetPath);
          const meta = noteMetaList.find((n) => n.path === targetPath);
          const filename = targetPath.split(/[/\\]/).pop() || 'Untitled.md';
          const title = filename.replace(/\.md$/i, '');
          const loadedNote: NoteFile = {
            path: targetPath,
            relative_path: meta?.relative_path || filename,
            title,
            content,
          };
          setActiveNote(loadedNote);

          // Update cached content for this note
          setAllNotes((prev) =>
            prev.map((n) => (n.path === targetPath ? { ...n, content } : n))
          );
        } else {
          setActiveNote(null);
        }

        // Asynchronously background-load remaining notes in idle time for backlink indexing
        setTimeout(async () => {
          const loaded: NoteFile[] = [];
          for (const note of noteMetaList) {
            if (note.path !== targetPath) {
              try {
                const c = await readNoteFile(note.path);
                loaded.push({ ...note, content: c });
              } catch {
                // ignore
              }
            }
          }
          if (loaded.length > 0) {
            setAllNotes((prev) =>
              prev.map((n) => {
                const found = loaded.find((l) => l.path === n.path);
                return found ? found : n;
              })
            );
          }
        }, 150);
      } catch (err) {
        console.error('Failed to load vault:', err);
      }
    },
    [vaultPath]
  );

  // Initial load
  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  // Open / switch vault folder
  const handleOpenVault = async () => {
    const selected = await pickVaultFolder();
    if (selected) {
      setVaultPath(selected);
      localStorage.setItem(LAST_VAULT_KEY, selected);
      await refreshVault(selected);
    }
  };

  // Select a note (lazily reads content if not loaded)
  const handleSelectNote = async (path: string, headingAnchor?: string) => {
    try {
      const meta = allNotes.find((n) => n.path === path);
      let content = meta?.content || '';
      if (!content) {
        content = await readNoteFile(path);
      }
      const filename = path.split(/[/\\]/).pop() || 'Untitled.md';
      const title = filename.replace(/\.md$/i, '');
      const note: NoteFile = {
        path,
        relative_path: meta?.relative_path || filename,
        title,
        content,
      };
      setActiveNote(note);
      setTargetHeadingAnchor(headingAnchor || null);

      // Cache content in allNotes
      setAllNotes((prev) =>
        prev.map((n) => (n.path === path ? { ...n, content } : n))
      );
    } catch (err) {
      console.error('Error opening note:', err);
    }
  };

  // Create a new note
  const handleCreateNote = async (folderPath?: string, requestedTitle?: string) => {
    const basePath = folderPath || vaultPath || '/QuantaVault';
    const separator = basePath.includes('\\') ? '\\' : '/';

    let title = requestedTitle?.trim() || '';
    if (!title) {
      let counter = 1;
      title = `Untitled ${counter}`;
      while (allNotes.some((n) => normalizeNoteTitle(n.title) === normalizeNoteTitle(title))) {
        counter++;
        title = `Untitled ${counter}`;
      }
    }

    const fileName = title.endsWith('.md') ? title : `${title}.md`;
    const newFilePath = `${basePath}${separator}${fileName}`;
    const initialContent = `# ${title.replace(/\.md$/i, '')}\n\n`;

    try {
      await createNoteFile(newFilePath, initialContent);
      await refreshVault();
      await handleSelectNote(newFilePath);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  // Create folder
  const handleCreateFolder = async (parentPath?: string) => {
    const base = parentPath || vaultPath || '/QuantaVault';
    const separator = base.includes('\\') ? '\\' : '/';
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    const newDirPath = `${base}${separator}${folderName.trim()}`;
    try {
      await createVaultDir(newDirPath);
      await refreshVault();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  // Rename path with vault-wide wikilink refactoring
  const handleRenamePath = async (oldPath: string, newPath: string) => {
    try {
      const oldFileName = oldPath.split(/[/\\]/).pop() || '';
      const newFileName = newPath.split(/[/\\]/).pop() || '';
      const isMdFile = oldFileName.endsWith('.md');

      // 1. Rename on disk
      await renameVaultPath(oldPath, newPath);

      // 2. If it's a markdown file, refactor inbound wikilinks across all other notes
      if (isMdFile) {
        const oldTitle = oldFileName.replace(/\.md$/i, '');
        const newTitle = newFileName.replace(/\.md$/i, '');

        for (const note of allNotes) {
          if (note.path !== oldPath && note.content) {
            const { updatedContent, count } = refactorWikilinksOnRename(
              note.content,
              oldTitle,
              newTitle
            );
            if (count > 0) {
              await writeNoteFile(note.path, updatedContent);
            }
          }
        }
      }

      await refreshVault();
      if (activeNote?.path === oldPath) {
        await handleSelectNote(newPath);
      }
    } catch (err) {
      console.error('Failed to rename path:', err);
    }
  };

  // Delete path
  const handleDeletePath = async (path: string) => {
    const name = path.split(/[/\\]/).pop();
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteVaultPath(path);
      if (activeNote?.path === path) {
        setActiveNote(null);
      }
      await refreshVault();
    } catch (err) {
      console.error('Failed to delete path:', err);
    }
  };

  // Autosave content changes with debounce (isolated from allNotes to prevent re-render thrashing)
  const handleContentChange = (newContent: string) => {
    if (!activeNote) return;

    setIsSaving(true);
    setActiveNote((prev) => (prev ? { ...prev, content: newContent } : null));

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await writeNoteFile(activeNote.path, newContent);
        // Sync cached content in allNotes without thrashing
        setAllNotes((prev) =>
          prev.map((n) => (n.path === activeNote.path ? { ...n, content: newContent } : n))
        );
      } catch (err) {
        console.error('Autosave failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 400);
  };

  // Navigate via Wikilink (resolves existing or creates new immediately)
  const handleNavigateWikilink = async (targetNote: string, headingAnchor?: string) => {
    const normalized = normalizeNoteTitle(targetNote);
    const existing = allNotes.find((n) => normalizeNoteTitle(n.title) === normalized);

    if (existing) {
      await handleSelectNote(existing.path, headingAnchor);
    } else {
      // Create new note immediately (Obsidian semantics)
      const cleanTitle = targetNote.trim();
      await handleCreateNote(undefined, cleanTitle);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsSwitcherOpen((prev) => !prev);
      } else if (isMod && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (isMod && (e.key === '\\' || e.key === '/')) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (isMod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleCreateNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allNotes, vaultPath]);

  // Lookup sets and metrics
  const existingTitles = useMemo(() => {
    return new Set(allNotes.map((n) => normalizeNoteTitle(n.title)));
  }, [allNotes]);

  const autocompleteList = useMemo(() => {
    return allNotes.map((n) => ({
      title: n.title,
      relativePath: n.relative_path,
    }));
  }, [allNotes]);

  const currentBacklinks = useMemo(() => {
    if (!activeNote) return [];
    return findBacklinks(activeNote.title, allNotes);
  }, [activeNote?.title, allNotes]);

  const flatNotesForSwitcher = useMemo(() => {
    return fileTree ? flattenVaultTree(fileTree) : [];
  }, [fileTree]);

  return (
    <div className="h-screen w-screen flex bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Collapsible Sidebar */}
      {isSidebarOpen && (
        <Sidebar
          vaultName={vaultName}
          fileTree={fileTree}
          activeNotePath={activeNote?.path || null}
          onSelectNote={(path) => handleSelectNote(path)}
          onCreateNote={(folder) => handleCreateNote(folder)}
          onCreateFolder={(parent) => handleCreateFolder(parent)}
          onRenamePath={handleRenamePath}
          onDeletePath={handleDeletePath}
          onOpenVault={handleOpenVault}
          onOpenSwitcher={() => setIsSwitcherOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Floating Sidebar Reopen Button when Sidebar is collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            title="Expand Sidebar (Ctrl+\)"
            className="absolute top-2 left-2 z-20 p-1.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Editor Surface with In-Flow Backlinks */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Editor
            activeNote={activeNote}
            onContentChange={handleContentChange}
            existingTitles={existingTitles}
            allNotesList={autocompleteList}
            onNavigateWikilink={handleNavigateWikilink}
            isSaving={isSaving}
            targetHeadingAnchor={targetHeadingAnchor}
            backlinks={currentBacklinks}
            onNavigateBacklink={(sourcePath) => handleSelectNote(sourcePath)}
            fontMode={fontMode}
            onChangeFontMode={handleFontModeChange}
            isFullWidth={isFullWidth}
            onToggleFullWidth={handleToggleFullWidth}
            isRtlAutoDetect={isRtlAutoDetect}
          />
        </div>
      </main>

      {/* Quick Switcher Modal */}
      <QuickSwitcher
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        notes={flatNotesForSwitcher}
        onSelectNote={(path) => handleSelectNote(path)}
        onCreateNote={(title) => handleCreateNote(undefined, title)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        vaultPath={vaultPath}
        vaultName={vaultName}
        onOpenVault={handleOpenVault}
        fontMode={fontMode}
        onChangeFontMode={handleFontModeChange}
        isFullWidth={isFullWidth}
        onToggleFullWidth={handleToggleFullWidth}
        isRtlAutoDetect={isRtlAutoDetect}
        onToggleRtlAutoDetect={handleToggleRtlAutoDetect}
      />
    </div>
  );
};
