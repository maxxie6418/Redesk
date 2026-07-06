import { Brain, Eye, FileJson, FileSpreadsheet, FileText, Highlighter, MessageSquareQuote, NotebookPen, PenSquare, Trash2 } from 'lucide-react';
import { FilterSelect } from '@/components/page-ui/filter-select';
import { SectionPanel } from '@/components/page-ui/section-panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadingNoteItem } from './data';

export function ReadingNoteCard({
  note,
  onEdit,
  onDelete,
  onNavigate,
}: {
  note: ReadingNoteItem;
  onEdit?: () => void;
  onDelete?: () => void;
  onNavigate?: () => void;
}) {
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
        <Button variant="outline" size="sm" disabled title="主题阅读功能即将上线（M4）">
          <Brain className="h-3.5 w-3.5" />
          加入话题
        </Button>
        {!isStandalone ? (
          <Button variant="outline" size="sm" onClick={onNavigate}>
            <Eye className="h-3.5 w-3.5" />
            回到书中
          </Button>
        ) : null}
        {onEdit ? (
        <Button variant="outline" size="sm" onClick={onEdit}>
          {isStandalone ? <PenSquare className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          {isStandalone ? '编辑' : isAnnotated ? '编辑批注' : '添加批注'}
        </Button>
      ) : null}
        {onDelete ? (
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function CompactSelect({ options }: { options: string[] }) {
  return <FilterSelect value={options[0] ?? ''} onChange={() => {}} options={options.map((option) => ({ value: option, label: option })} size="default" />;
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

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([type.startsWith('text/') ? '\uFEFF' + content : content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchExportData(bookId: number, endpoint: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  const res = await fetch(`${base}/export/books/${bookId}/${endpoint}`, { credentials: 'include' });
  if (!res.ok) throw new Error('导出请求失败');
  return res.json() as Promise<{ data: Record<string, unknown> }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function toMarkdown(data: { notes?: Array<Record<string, unknown>>; highlights?: Array<Record<string, unknown>> }, bookTitle: string): string {
  const lines: string[] = [`# ${bookTitle} - 阅读笔记导出`, '', `导出时间: ${new Date().toLocaleString('zh-CN')}`, '', '---', ''];
  if (data.highlights && data.highlights.length > 0) {
    lines.push('## 高亮', '');
    for (const h of data.highlights) {
      lines.push(`> ${h.text}`, '');
      if (h.note) lines.push(`附注: ${h.note}`, '');
      lines.push(`> — ${formatDate(h.created_at as string)}`, '');
      lines.push('---', '');
    }
  }
  if (data.notes && data.notes.length > 0) {
    lines.push('## 笔记', '');
    for (const n of data.notes) {
      const title = n.title ? String(n.title) : '无标题';
      lines.push(`### ${title}`, '');
      if (n.content_markdown) lines.push(String(n.content_markdown), '');
      lines.push(`> — ${formatDate(n.created_at as string)}`, '');
      lines.push('---', '');
    }
  }
  return lines.join('\n');
}

function toCsv(data: { notes?: Array<Record<string, unknown>>; highlights?: Array<Record<string, unknown>> }): string {
  const rows: string[] = ['类型,内容,附注,日期'];
  if (data.highlights) {
    for (const h of data.highlights) {
      const text = `"${(h.text as string ?? '').replace(/"/g, '""')}"`;
      const note = `"${(h.note as string ?? '').replace(/"/g, '""')}"`;
      rows.push(`高亮,${text},${note},${h.created_at ?? ''}`);
    }
  }
  if (data.notes) {
    for (const n of data.notes) {
      const title = `"${(n.title as string ?? '无标题').replace(/"/g, '""')}"`;
      const content = `"${(n.content_markdown as string ?? '').replace(/"/g, '""')}"`;
      rows.push(`笔记,${title},${content},${n.created_at ?? ''}`);
    }
  }
  return rows.join('\n');
}

async function handleExportJson(bookId: number, _bookTitle: string) {
  try {
    const { data } = await fetchExportData(bookId, 'marks');
    downloadBlob(JSON.stringify(data, null, 2), `notes-${bookId}-${Date.now()}.json`, 'application/json');
  } catch {
    // 导出失败静默处理
  }
}

async function handleExportMarkdown(bookId: number, bookTitle: string) {
  try {
    const { data } = await fetchExportData(bookId, 'marks');
    const md = toMarkdown(data, bookTitle);
    downloadBlob(md, `notes-${bookId}-${Date.now()}.md`, 'text/markdown');
  } catch {
    // 导出失败静默处理
  }
}

async function handleExportCsv(bookId: number, _bookTitle: string) {
  try {
    const { data } = await fetchExportData(bookId, 'marks');
    const csv = toCsv(data);
    downloadBlob(csv, `notes-${bookId}-${Date.now()}.csv`, 'text/csv');
  } catch {
    // 导出失败静默处理
  }
}

export function ExportActions({ bookId, bookTitle }: { bookId?: number; bookTitle?: string }) {
  const hasBook = bookId != null && bookId > 0;
  const title = bookTitle ?? '';
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="flex-1" disabled={!hasBook} title={hasBook ? '导出 Markdown' : '请先选择一本具体书籍'}
        onClick={() => hasBook && handleExportMarkdown(bookId, title)}>
        Markdown
      </Button>
      <Button variant="outline" size="sm" className="flex-1" disabled={!hasBook} title={hasBook ? '导出 JSON' : '请先选择一本具体书籍'}
        onClick={() => hasBook && handleExportJson(bookId, title)}>
        <FileJson className="h-3.5 w-3.5" />
        JSON
      </Button>
      <Button variant="outline" size="sm" className="flex-1" disabled={!hasBook} title={hasBook ? '导出 CSV' : '请先选择一本具体书籍'}
        onClick={() => hasBook && handleExportCsv(bookId, title)}>
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
