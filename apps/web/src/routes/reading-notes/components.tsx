import { Brain, Eye, FileJson, FileSpreadsheet, FileText, Highlighter, MessageSquareQuote, NotebookPen, PenSquare } from 'lucide-react';
import { FilterSelect } from '@/components/page-ui/filter-select';
import { SectionPanel } from '@/components/page-ui/section-panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadingNoteItem } from './data';

export function ReadingNoteCard({ note }: { note: ReadingNoteItem }) {
  const isStandalone = note.type === 'standalone';
  const isAnnotated = note.type === 'annotated';

  return (
    <article className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {isStandalone ? <NotebookPen className="h-5 w-5" /> : isAnnotated ? <MessageSquareQuote className="h-5 w-5" /> : <Highlighter className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isStandalone ? (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">独立笔记</span>
            ) : (
              <>
                <span className="font-medium text-foreground">《{note.sourceTitle}》</span>
                {note.author ? <span>· {note.author}</span> : null}
                <span>· {note.chapter}</span>
              </>
            )}
            <span className="sm:ml-auto">{note.createdAt}</span>
          </div>

          {note.quote ? (
            <blockquote
              className={cn(
                'mb-3 border-l-2 pl-3 text-[15px] leading-relaxed text-foreground',
                note.highlightTone === 'success' ? 'border-success' : note.highlightTone === 'info' ? 'border-sky-700' : 'border-primary',
              )}
            >
              {note.quote}
            </blockquote>
          ) : null}

          {note.summary ? <div className="mb-3 text-sm leading-relaxed text-foreground/90">{note.summary}</div> : null}
          {note.content ? <div className="mb-3 text-sm leading-relaxed text-foreground/90">{note.content}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            {note.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-[3px] text-xs text-muted-foreground transition-colors hover:text-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <Button variant="outline" size="sm">
          <Brain className="h-3.5 w-3.5" />
          加入话题
        </Button>
        {!isStandalone ? (
          <Button variant="outline" size="sm">
            <Eye className="h-3.5 w-3.5" />
            回到书中
          </Button>
        ) : null}
        <Button variant="outline" size="sm">
          {isStandalone ? <PenSquare className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          {isStandalone ? '编辑' : isAnnotated ? '编辑批注' : '添加批注'}
        </Button>
      </div>
    </article>
  );
}

export function CompactSelect({ options }: { options: string[] }) {
  return <FilterSelect value={options[0] ?? ''} onChange={() => {}} options={options.map((option) => ({ value: option, label: option }))} size="md" />;
}

export function SourcePill({
  active,
  title,
  count,
  onClick,
  tone,
}: {
  active: boolean;
  title: string;
  count: number;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent')}
    >
      {tone ? <div className={cn('h-5 w-4 rounded-sm', tone)} /> : null}
      <span>{title}</span>
      <span className={cn('text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}

export function SidebarPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <SectionPanel title={title} description={description}>
      {children}
    </SectionPanel>
  );
}

export function ExportActions() {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="flex-1">
        Markdown
      </Button>
      <Button variant="outline" size="sm" className="flex-1">
        <FileJson className="h-3.5 w-3.5" />
        JSON
      </Button>
      <Button variant="outline" size="sm" className="flex-1">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        CSV
      </Button>
    </div>
  );
}

export function PaginationButton({
  active,
  disabled,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-lg border text-sm transition-colors',
        active ? 'border-primary bg-primary px-3 text-primary-foreground' : 'border-border bg-card px-2 text-foreground hover:bg-accent',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}
