import React, { useState } from 'react';
import { BacklinkMention } from '../types/vault';
import { ChevronRight, ChevronDown, Link2, FileText } from 'lucide-react';

interface LinkedReferencesProps {
  targetTitle: string;
  backlinks: BacklinkMention[];
  onNavigate: (sourcePath: string) => void;
}

export const LinkedReferences: React.FC<LinkedReferencesProps> = ({
  targetTitle,
  backlinks,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!targetTitle) return null;

  return (
    <div className="border-t border-zinc-900/80 pt-6 mt-8 pb-12 select-none">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors w-full"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        )}
        <Link2 className="w-3.5 h-3.5 text-sky-400" />
        <span>Linked References</span>
        <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
          {backlinks.length}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {backlinks.length === 0 ? (
            <div className="text-xs text-zinc-600 italic py-2 pl-5">
              No notes in this vault link to "{targetTitle}" yet.
            </div>
          ) : (
            <div className="space-y-2 pl-2">
              {backlinks.map((link, idx) => (
                <div
                  key={`${link.sourcePath}-${link.line}-${idx}`}
                  onClick={() => onNavigate(link.sourcePath)}
                  className="group p-2.5 rounded border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-zinc-800 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center space-x-1.5 text-zinc-300 group-hover:text-sky-300 font-medium">
                      <FileText className="w-3 h-3 text-zinc-500 group-hover:text-sky-400" />
                      <span>{link.sourceTitle}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">
                      line {link.line}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 font-mono line-clamp-2 pl-4 border-l border-zinc-800 group-hover:border-sky-500/40">
                    {link.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
