import { useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BubbleToolbar, type MarkType } from '@/components/highlight-toolbar';
import { CommentInput } from '@/components/reader/comment-input';
import { ImagePreviewViewer, PdfPreviewViewer, TextPreviewViewer, UnsupportedPreviewViewer } from '@/components/reader/preview-viewers';
import { toast } from 'sonner';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useBook } from '@/hooks/use-books';
import { useHighlights, useCreateHighlight, useUpdateHighlight, useDeleteHighlight, useNotes, useCreateNote, useUpdateNote, useDeleteNote, useBookmarks, useCreateBookmark, useDeleteBookmark, type HighlightItem } from '@/hooks/use-notes';
import { useAddTopicHighlight } from '@/hooks/use-topics';
import { Button } from '@/components/ui/button';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { API_BASE } from '@/lib/api';
import { normalizeFileFormat, selectReadableFile } from '@redesk/shared';
import { HighlightEditPopover, ReaderEmptyState, ReaderNotesPanel, ReaderPreviewShell, ReaderTopBar, TocPanel, type EditingHighlight } from './book-reader/components';
import { useEpubReader } from './book-reader/use-epub-reader';
import { useReadingProgressSync } from './book-reader/reading-progress-sync';
import { useReaderHighlightActions, type ReaderSelectionState } from './book-reader/use-reader-highlight-actions';
import { useReaderHighlightRenderer } from './book-reader/use-reader-highlight-renderer';
import { useReaderKeyboardNavigation } from './book-reader/use-reader-keyboard-navigation';
import { useReaderNotes } from './book-reader/use-reader-notes';

export function BookReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCfiRef = useRef<string | null>(searchParams.get('cfi'));

  const book = useBook(bookId);
  const files = useBookFiles(bookId);
  const highlights = useHighlights(bookId);
  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const bookNotes = useNotes(bookId);
  const addTopicHighlight = useAddTopicHighlight();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const bookmarks = useBookmarks(bookId);
  const createBookmark = useCreateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const [tocOpen, setTocOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [selection, setSelection] = useState<ReaderSelectionState | null>(null);
  const [activeMarkType, setActiveMarkType] = useState<MarkType>(null);
  const [selectionHighlightId, setSelectionHighlightId] = useState<number | null>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [commentTargetHighlightId, setCommentTargetHighlightId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingHighlight | null>(null);
  const [topicHighlightId, setTopicHighlightId] = useState<number | null>(null);


  const readableFile = selectReadableFile<BookFileItem>(files.data);
  const readableFileId = readableFile?.id;
  const readableFormat = normalizeFileFormat(readableFile?.file_format);
  const isEpub = readableFormat === 'EPUB';
  const primaryEpubId = isEpub ? readableFileId : undefined;
  const bookTitle = book.data?.title ?? '';
  const { saveProgress, syncMessage } = useReadingProgressSync({
    bookId,
    fileId: primaryEpubId,
  });
  const highlightsMapRef = useRef<Map<string, HighlightItem>>(new Map());
  const {
    viewerRef,
    toc,
    currentTitle,
    loading,
    error,
    getCurrentCfi,
    getRendition,
    goPrev,
    goNext,
    goToHref: displayHref,
  } = useEpubReader({
    bookId,
    bookTitle,
    primaryEpubId,
    initialCfi: initialCfiRef.current,
    highlightsMapRef,
    saveProgress,
    setSelection,
    setActiveMarkType,
    setSelectionHighlightId,
    setCommentMode,
    setCommentTargetHighlightId,
  });
  useReaderHighlightRenderer({
    loading,
    highlightsMapRef,
    highlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getRendition,
    setEditing,
  });
  const {
    noteForm,
    editingNote,
    setNoteForm,
    setEditingNote,
    handleOpenNoteForm,
    handleSubmitNote,
    handleEditNote,
    handleSubmitEditNote,
    handleDeleteNote,
  } = useReaderNotes({
    bookId,
    getCurrentCfi,
    notesQuery: bookNotes,
    createNote,
    updateNote,
    deleteNote,
  });
  const {
    handleCreateHighlight,
    handleCreateUnderline,
    handleCreateWavy,
    handleClearMark,
    handleBookmark,
    handleOpenComment,
    handleCommentSave,
    handleCommentCancel,
    handleDismissSelection,
  } = useReaderHighlightActions({
    bookId,
    primaryEpubId,
    selection,
    selectionHighlightId,
    commentTargetHighlightId,
    bookmarks: bookmarks.data,
    highlightsMap: highlightsMapRef.current,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    createBookmark,
    deleteBookmark,
    setSelection,
    setCommentMode,
    setCommentTargetHighlightId,
    setActiveMarkType,
    setSelectionHighlightId,
    setEditing,
  });

  const toggleToc = () => {
    setTocOpen(!tocOpen);
    setNotesPanelOpen(false);
  };

  const toggleNotesPanel = () => {
    setNotesPanelOpen(!notesPanelOpen);
    setTocOpen(false);
  };

  const goToHref = (href: string) => {
    displayHref(href);
    setTocOpen(false);
  };

  useReaderKeyboardNavigation({ activeKey: primaryEpubId, getRendition });

  if (book.isLoading || files.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!readableFile) {
    return <ReaderEmptyState onBack={() => navigate(`/books/${bookId}`)} />;
  }

  if (!isEpub) {
    const previewUrl = `${API_BASE}/books/${bookId}/files/${readableFile.id}/download`;
    const title = book.data?.title ?? readableFile.original_filename ?? '文件预览';
    let viewer = <UnsupportedPreviewViewer url={previewUrl} format={readableFormat} />;

    if (readableFormat === 'PDF') {
      viewer = <PdfPreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    } else if (readableFormat === 'TXT' || readableFormat === 'MD' || readableFormat === 'MARKDOWN') {
      viewer = <TextPreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    } else if (readableFormat === 'JPG' || readableFormat === 'JPEG' || readableFormat === 'PNG') {
      viewer = <ImagePreviewViewer url={previewUrl} title={title} format={readableFormat} filename={readableFile.original_filename} />;
    }

    return (
      <ReaderPreviewShell title={title} subtitle={readableFile.original_filename ?? readableFormat} onBack={() => navigate(`/books/${bookId}`)}>
        {viewer}
      </ReaderPreviewShell>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <ReaderTopBar
        title={currentTitle || book.data?.title}
        syncMessage={syncMessage}
        onBack={() => navigate(`/books/${bookId}`)}
        onToggleToc={toggleToc}
        onToggleNotes={toggleNotesPanel}
        onPrev={goPrev}
        onNext={goNext}
      />

      <div className="relative flex-1 overflow-hidden">
        {tocOpen && <TocPanel toc={toc} onClose={() => setTocOpen(false)} onOpenItem={goToHref} />}

        {notesPanelOpen && (
          <ReaderNotesPanel
            notes={bookNotes.data ?? []}
            isLoading={bookNotes.isLoading}
            noteForm={noteForm}
            editingNote={editingNote}
            onClose={() => setNotesPanelOpen(false)}
            onOpenNoteForm={handleOpenNoteForm}
            onChangeNoteForm={setNoteForm}
            onSubmitNote={handleSubmitNote}
            onEditNote={handleEditNote}
            onChangeEditingNote={setEditingNote}
            onSubmitEditNote={handleSubmitEditNote}
            onDeleteNote={handleDeleteNote}
          />
        )}

        <div ref={viewerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 新选区气泡工具条 */}
      <BubbleToolbar
        rect={selection?.rect ?? null}
        visible={selection !== null && !commentMode}
        activeType={activeMarkType}
        hasBookmark={bookmarks.data?.some((b) => b.cfi === selection?.cfi)}
        showClear={selectionHighlightId != null}
        onHighlight={handleCreateHighlight}
        onUnderline={handleCreateUnderline}
        onWavy={handleCreateWavy}
        onBookmark={handleBookmark}
        onComment={handleOpenComment}
        onClear={handleClearMark}
        onDismiss={handleDismissSelection}
      />

      {/* 评论迷你输入 */}
      <CommentInput
        rect={selection?.rect ?? null}
        visible={commentMode}
        onSave={handleCommentSave}
        onCancel={handleCommentCancel}
      />

      {/* 已有高亮编辑态气泡 */}
      <AddToTopicDialog
        open={topicHighlightId !== null}
        title="将高亮加入话题"
        description="选择一个主题阅读话题，或新建话题后自动关联当前高亮。"
        loading={addTopicHighlight.isPending}
        onCancel={() => setTopicHighlightId(null)}
        onConfirm={async (topicId) => {
          if (!topicHighlightId) return;
          await addTopicHighlight.mutateAsync({ topicId, highlightId: topicHighlightId });
          toast.success('高亮已加入话题');
          setTopicHighlightId(null);
        }}
      />

      {editing && (
        <HighlightEditPopover
          editing={editing}
          onComment={(id) => {
            setCommentTargetHighlightId(id);
            setCommentMode(true);
            setEditing(null);
          }}
          onAddToTopic={(id) => {
            setTopicHighlightId(id);
            setEditing(null);
          }}
          onDelete={(id) => {
            deleteHighlight.mutate(id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
