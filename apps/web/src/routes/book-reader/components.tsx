import { ArrowLeft, Check, ChevronLeft, ChevronRight, Menu, Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react';
import type { NoteItem } from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';

export interface TocItem {
  id: string;
  label: string;
  href: string;
}

interface ReaderTopBarProps {
  title: string | undefined;
  syncMessage: string | null;
  onBack: () => void;
  onToggleToc: () => void;
  onToggleNotes: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ReaderTopBar({ title, syncMessage, onBack, onToggleToc, onToggleNotes, onPrev, onNext }: ReaderTopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleToc}>
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleNotes}>
        <StickyNote className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {syncMessage ? <div className="truncate text-xs text-amber-600 dark:text-amber-300">{syncMessage}</div> : null}
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
