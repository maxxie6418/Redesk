import type { ReactNode } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Maximize, Menu, Pencil, Plus, Search, Palette, StickyNote, Trash2, Volume2, X } from 'lucide-react';
import type { NoteItem } from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';

export interface TocItem {
  id: string;
  label: string;
  href: string;
}

export interface EditingHighlight {
  id: number;
  note: string | null;
  markType: string;
  position: { top: number; left: number };
}

interface ReaderTopBarProps {
  title: string | undefined;
  syncMessage: string | null;
  currentPage?: number;
  totalPages?: number;
  sessionDuration?: number;
  estimatedRemainingSeconds?: number | null;
  focusMode?: boolean;
  onBack: () => void;
  onToggleToc: () => void;
  onToggleNotes: () => void;
  onToggleSearch?: () => void;
  onToggleTheme?: () => void;
  onToggleTts?: () => void;
  onToggleFocus?: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function formatSessionDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ReaderTopBar({
  title,
  syncMessage,
  currentPage,
  totalPages,
  sessionDuration,
  estimatedRemainingSeconds,
  focusMode,
  onBack,
  onToggleToc,
  onToggleNotes,
  onToggleSearch,
  onToggleTheme,
  onToggleTts,
  onToggleFocus,
  onPrev,
  onNext,
}: ReaderTopBarProps) {
  return (
    <header className={`flex items-center gap-3 border-b border-border px-4 py-2.5 transition-opacity duration-300 ${focusMode ? 'group opacity-0 hover:opacity-100' : ''}`}>
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleToc}>
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleNotes}>
        <StickyNote className="h-5 w-5" />
      </Button>
      {onToggleSearch && (
        <Button variant="ghost" size="icon" onClick={onToggleSearch}>
          <Search className="h-5 w-5" />
        </Button>
      )}
      {onToggleTheme && (
        <Button variant="ghost" size="icon" onClick={onToggleTheme}>
          <Palette className="h-5 w-5" />
        </Button>
      )}
      {onToggleTts && (
        <Button variant="ghost" size="icon" onClick={onToggleTts}>
          <Volume2 className="h-5 w-5" />
        </Button>
      )}
      {onToggleFocus && (
        <Button variant="ghost" size="icon" onClick={onToggleFocus}>
          <Maximize className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {currentPage != null && totalPages != null && totalPages > 0 && (
            <span>第 {currentPage} / {totalPages} 页</span>
          )}
          {sessionDuration != null && sessionDuration > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {formatSessionDuration(sessionDuration)}
            </span>
          )}
          {estimatedRemainingSeconds != null && estimatedRemainingSeconds > 0 && (
            <span>剩余 ≈ {formatSessionDuration(estimatedRemainingSeconds)}</span>
          )}
          {syncMessage && <span className="text-amber-600 dark:text-amber-300">{syncMessage}</span>}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onPrev}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </header>
  );
}

interface TocPanelProps {
  toc: TocItem[];
  onClose: () => void;
  onOpenItem: (href: string) => void;
}

export function TocPanel({ toc, onClose, onOpenItem }: TocPanelProps) {
  return (
    <div className="absolute left-0 top-0 z-20 h-full w-64 border-r border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium">目录</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="h-[calc(100%-49px)] overflow-y-auto">
        {toc.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">暂无目录</div>
        ) : (
          <ul className="py-1">
            {toc.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(item.href)}
                  className="w-full px-4 py-2 text-left text-sm text-foreground/80 hover:bg-muted"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface ReaderNotesPanelProps {
  notes: NoteItem[];
  isLoading: boolean;
  noteForm: { title: string; content: string } | null;
  editingNote: { id: number; title: string; content: string } | null;
  onClose: () => void;
  onOpenNoteForm: () => void;
  onChangeNoteForm: (value: { title: string; content: string } | null) => void;
  onSubmitNote: () => void;
  onEditNote: (note: NoteItem) => void;
  onChangeEditingNote: (value: { id: number; title: string; content: string } | null) => void;
  onSubmitEditNote: () => void;
  onDeleteNote: (id: number) => void;
}

export function ReaderNotesPanel({
  notes,
  isLoading,
  noteForm,
  editingNote,
  onClose,
  onOpenNoteForm,
  onChangeNoteForm,
  onSubmitNote,
  onEditNote,
  onChangeEditingNote,
  onSubmitEditNote,
  onDeleteNote,
}: ReaderNotesPanelProps) {
  return (
    <div className="absolute left-0 top-0 z-20 flex h-full w-72 flex-col border-r border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium">笔记</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {noteForm ? (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="笔记标题"
              value={noteForm.title}
              onChange={(event) => onChangeNoteForm({ ...noteForm, title: event.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              placeholder="笔记内容（可选）"
              value={noteForm.content}
              onChange={(event) => onChangeNoteForm({ ...noteForm, content: event.target.value })}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={4}
            />
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => onChangeNoteForm(null)}>
                取消
              </Button>
              <Button variant="default" size="sm" onClick={onSubmitNote}>
                <Check className="mr-1 h-3 w-3" />
                保存
              </Button>
            </div>
          </div>
        ) : editingNote ? (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="笔记标题"
              value={editingNote.title}
              onChange={(event) => onChangeEditingNote({ ...editingNote, title: event.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              placeholder="笔记内容"
              value={editingNote.content}
              onChange={(event) => onChangeEditingNote({ ...editingNote, content: event.target.value })}
              className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={4}
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => onChangeEditingNote(null)}>
                取消
              </Button>
              <Button variant="default" size="sm" onClick={onSubmitEditNote}>
                <Check className="mr-1 h-3 w-3" />
                更新
              </Button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenNoteForm}
              className="flex w-full items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              在当前页添加笔记
            </button>
            <div className="space-y-1.5 pt-1">
              {isLoading ? (
                <div className="px-1 py-4 text-center text-xs text-muted-foreground">加载中...</div>
              ) : notes.length === 0 ? (
                <div className="px-1 py-4 text-center text-xs text-muted-foreground">暂无笔记</div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="group rounded border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium text-foreground">{note.title || '无标题'}</span>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => onEditNote(note)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => onDeleteNote(note.id)} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {note.content_markdown && <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground/70">{note.content_markdown}</p>}
                    {note.cfi && <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/40">{note.cfi.slice(0, 40)}...</p>}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface HighlightEditPopoverProps {
  editing: EditingHighlight;
  onComment: (id: number) => void;
  onAddToTopic: (id: number) => void;
  onDelete: (id: number) => void;
}

export function HighlightEditPopover({ editing, onComment, onAddToTopic, onDelete }: HighlightEditPopoverProps) {
  return (
    <div
      className="fixed z-50 anim-pop"
      style={{
        top: (editing.position?.top ?? 0) - 60,
        left: editing.position?.left ?? 0,
      }}
    >
      <div
        className="relative flex items-center gap-1 rounded-[14px] border bg-white px-2 py-1.5"
        style={{
          borderColor: '#e5e5e5',
          boxShadow: '0 10px 30px -8px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="absolute -bottom-[6px] left-4 h-3 w-3 bg-white"
          style={{
            borderRight: '1px solid #e5e5e5',
            borderBottom: '1px solid #e5e5e5',
            transform: 'rotate(45deg)',
          }}
        />
        <button
          type="button"
          onClick={() => onComment(editing.id)}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {editing.note ? '编辑附注' : '添加附注'}
        </button>
        <div className="h-5 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={() => onAddToTopic(editing.id)}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 12V7a2 2 0 0 0-2-2h-5" />
            <path d="M14 17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
          加入话题
        </button>
        <div className="h-5 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={() => onDelete(editing.id)}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-red-500 hover:bg-red-50"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          删除
        </button>
      </div>
    </div>
  );
}

interface ReaderEmptyStateProps {
  onBack: () => void;
}

export function ReaderEmptyState({ onBack }: ReaderEmptyStateProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-muted-foreground">没有可在线预览的主阅读文件</p>
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回详情
      </Button>
    </div>
  );
}

interface ReaderPreviewShellProps {
  title: string;
  subtitle: string | null | undefined;
  onBack: () => void;
  children: ReactNode;
}

export function ReaderPreviewShell({ title, subtitle, onBack, children }: ReaderPreviewShellProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
