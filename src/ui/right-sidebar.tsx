import type { BacklinkMention } from '../vault/types';
import type { Heading } from '../vault/note-meta';

interface Props {
  headings: Heading[];
  tags: string[];
  incoming: BacklinkMention[];
  outgoing: string[];
  onOpenHeading: (text: string) => void;
  onOpenNote: (pathOrTitle: string, heading?: string) => void;
  onOpenBacklink: (path: string) => void;
}

function Section({
  label,
  count,
  children,
  empty,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  empty: string;
}) {
  return (
    <section className="px-3 py-3 border-b border-[var(--line)]">
      <h2 className="text-[12px] font-medium mb-2 flex items-baseline justify-between">
        <span>{label}</span>
        <span className="text-[var(--muted)] tabular-nums">{count}</span>
      </h2>
      {count === 0 ? <p className="text-[12px] text-[var(--muted)]">{empty}</p> : children}
    </section>
  );
}

export function RightSidebar({
  headings,
  tags,
  incoming,
  outgoing,
  onOpenHeading,
  onOpenNote,
  onOpenBacklink,
}: Props) {
  return (
    <aside className="w-[260px] shrink-0 h-full border-s border-[var(--line)] bg-[var(--bg-raised)] overflow-y-auto">
      <Section label="Outline" count={headings.length} empty="No headings in this note.">
        <ul className="space-y-0.5">
          {headings.map((h) => (
            <li key={`${h.line}-${h.text}`}>
              <button
                type="button"
                onClick={() => onOpenHeading(h.text)}
                className="w-full text-start text-[13px] py-0.5 hover:text-[var(--fill-strong)] truncate"
                style={{ paddingInlineStart: (h.level - 1) * 12 }}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Tags" count={tags.length} empty="No tags yet. Write #tag in a note.">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[12px] border border-[var(--line)]">
              #{tag}
            </span>
          ))}
        </div>
      </Section>

      <Section label="Incoming" count={incoming.length} empty="Nothing links here yet.">
        <ul className="space-y-2">
          {incoming.map((b) => (
            <li key={`${b.sourcePath}-${b.line}`}>
              <button type="button" onClick={() => onOpenBacklink(b.sourcePath)} className="w-full text-start">
                <div className="text-[13px] truncate">{b.sourceTitle}</div>
                <div className="text-[12px] text-[var(--muted)] truncate">{b.snippet}</div>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Outgoing" count={outgoing.length} empty="No wikilinks in this note.">
        <ul>
          {outgoing.map((target) => (
            <li key={target}>
              <button
                type="button"
                onClick={() => onOpenNote(target)}
                className="w-full text-start text-[13px] py-0.5 hover:text-[var(--fill-strong)] truncate"
              >
                {target}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}
