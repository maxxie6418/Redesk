import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { BubbleToolbar, type MarkType } from '@/components/highlight-toolbar';
import { CommentInput } from '@/components/reader/comment-input';
import { ImagePreviewViewer, PdfPreviewViewer, TextPreviewViewer, UnsupportedPreviewViewer } from '@/components/reader/preview-viewers';
import { toast } from 'sonner';
import { useBookFiles, type BookFileItem } from '@/hooks/use-files';
import { useBook } from '@/hooks/use-books';
import { useHighlights, useCreateHighlight, useUpdateHighlight, useDeleteHighlight, useNotes, useCreateNote, useUpdateNote, useDeleteNote, useBookmarks, useCreateBookmark, useDeleteBookmark, type HighlightItem } from '@/hooks/use-notes';
import { useAddTopicHighlight } from '@/hooks/use-topics';
import { useReadingStatsSummary } from '@/hooks/use-reading-stats';
import { Button } from '@/components/ui/button';
import { AddToTopicDialog } from '@/components/add-to-topic-dialog';
import { API_BASE } from '@/lib/api';
import { normalizeFileFormat, selectReadableFile, defaultQuickTemplates, type QuickTemplate as SharedQuickTemplate } from '@redesk/shared';
import { HighlightEditPopover, ReaderEmptyState, ReaderNotesPanel, ReaderPreviewShell, ReaderTopBar, TocPanel, type EditingHighlight } from './book-reader/components';
import { useEpubReader } from './book-reader/use-epub-reader';
import { useReadingProgressSync } from './book-reader/reading-progress-sync';
import { useReaderHighlightActions, type ReaderSelectionState } from './book-reader/use-reader-highlight-actions';
import { useReaderHighlightRenderer } from './book-reader/use-reader-highlight-renderer';
import { useReaderKeyboardNavigation } from './book-reader/use-reader-keyboard-navigation';
import { useReaderNotes } from './book-reader/use-reader-notes';
import { useReaderPreferences } from './book-reader/use-reader-preferences';
import { ThemeSettingsPanel } from './book-reader/theme-settings-panel';
import { SearchPanel } from './book-reader/search-panel';
import { useTts } from './book-reader/use-tts';
import { useReadingSession } from './book-reader/use-reading-session';

const COLOR_SCHEMES_MAP: Record<string, { bg: string; text: string }> = {
  default: { bg: '#ffffff', text: '#1a1a1a' },
  sepia: { bg: '#f4ecd8', text: '#5b4636' },
  green: { bg: '#c7edcc', text: '#1a3a1a' },
  dark: { bg: '#1a1a1a', text: '#e0e0e0' },
};

const QUICK_TEMPLATES = defaultQuickTemplates;

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [ttsBarOpen, setTtsBarOpen] = useState(false);

  const { preferences, updatePreferences } = useReaderPreferences();

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
    currentPage,
    totalPages,
    epubLang,
    loading,
    error,
    getCurrentCfi,
    getRendition,
    getBookRef,
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

  const tts = useTts(getRendition, epubLang);
  const { sessionDuration } = useReadingSession({ bookId, enabled: isEpub && !loading && !!primaryEpubId });
  const readingStats = useReadingStatsSummary();

  const estimatedRemainingSeconds = useMemo(() => {
    const stats = readingStats.data;
    if (!stats || !totalPages || totalPages === 0) return null;
    const currentPct = (currentPage / totalPages) * 100;
    if (currentPct < 5) return null;
    if (stats.total_seconds <= 0) return null;
    const secondsPerPercent = stats.total_seconds / currentPct;
    const remainingPercent = 100 - currentPct;
    return Math.round(secondsPerPercent * remainingPercent);
  }, [readingStats.data, currentPage, totalPages]);

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
    setSearchOpen(false);
    setThemeOpen(false);
  };

  const toggleNotesPanel = () => {
    setNotesPanelOpen(!notesPanelOpen);
    setTocOpen(false);
    setSearchOpen(false);
    setThemeOpen(false);
  };

  const toggleSearch = () => {
    setSearchOpen(!searchOpen);
    setTocOpen(false);
    setNotesPanelOpen(false);
    setThemeOpen(false);
  };

  const toggleTheme = () => {
    setThemeOpen(!themeOpen);
    setSearchOpen(false);
    setTocOpen(false);
    setNotesPanelOpen(false);
  };

  const toggleFocus = () => {
    setFocusMode(!focusMode);
  };

  const toggleTts = () => {
    if (ttsBarOpen) {
      tts.stop();
    }
    setTtsBarOpen(!ttsBarOpen);
  };

  const handleEscape = () => {
    if (searchOpen) setSearchOpen(false);
    else if (themeOpen) setThemeOpen(false);
    else if (tocOpen) setTocOpen(false);
    else if (notesPanelOpen) setNotesPanelOpen(false);
    else if (focusMode) setFocusMode(false);
  };

  const goToHref = (href: string) => {
    displayHref(href);
    setTocOpen(false);
  };

  const handleQuickTemplate = async (template: SharedQuickTemplate) => {
    if (!selection) return;
    await createHighlight.mutateAsync({
      book_id: bookId,
      cfi_start: selection.cfi,
      cfi_end: selection.cfi,
      text: selection.text,
      type: 'HIGHLIGHT',
      note: `[${template.note_prefix}]`,
      mark_type: template.mark_type,
    });
    toast.success(`已标记为「${template.label}」`);
    setSelection(null);
  };

  useEffect(() => {
    const rendition = getRendition();
    if (!rendition) return;
    const scheme = COLOR_SCHEMES_MAP[preferences.color_scheme] || COLOR_SCHEMES_MAP.default;
    rendition.themes.override('color', scheme.text);
    rendition.themes.override('background', scheme.bg);
    if (preferences.font_family) {
      rendition.themes.font(preferences.font_family);
    }
    rendition.themes.override('font-size', `${preferences.font_size}px`);
    rendition.themes.override('line-height', String(preferences.line_height));
  }, [preferences, getRendition, loading]);

  useEffect(() => {
    if (!focusMode) {
      setCursorHidden(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      setCursorHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorHidden(true), 3000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
    };
  }, [focusMode]);

  useReaderKeyboardNavigation({
    activeKey: primaryEpubId,
    getRendition,
    onToggleToc: toggleToc,
    onToggleNotes: toggleNotesPanel,
    onToggleSearch: toggleSearch,
    onToggleTheme: toggleTheme,
    onToggleFocus: toggleFocus,
    onToggleTts: toggleTts,
    onEscape: handleEscape,
  });

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
    <div className={`flex h-screen flex-col bg-background ${cursorHidden ? 'cursor-none' : ''}`}>
      <ReaderTopBar
        title={currentTitle || book.data?.title}
        syncMessage={syncMessage}
        currentPage={currentPage}
        totalPages={totalPages}
        sessionDuration={sessionDuration}
        estimatedRemainingSeconds={estimatedRemainingSeconds}
        focusMode={focusMode}
        onBack={() => navigate(`/books/${bookId}`)}
        onToggleToc={toggleToc}
        onToggleNotes={toggleNotesPanel}
        onToggleSearch={toggleSearch}
        onToggleTheme={toggleTheme}
        onToggleTts={toggleTts}
        onToggleFocus={toggleFocus}
        onPrev={goPrev}
        onNext={goNext}
      />

      {ttsBarOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-1.5">
          <Button variant="ghost" size="sm" onClick={() => (tts.paused ? tts.resume() : tts.speaking ? tts.pause() : tts.speakCurrentPage())}>
            {tts.paused ? <Play className="h-4 w-4" /> : tts.speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={tts.stop} disabled={!tts.speaking && !tts.paused}>
            <Square className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">语速</span>
          <input type="range" min={0.5} max={2.0} step={0.1} value={tts.rate} onChange={(e) => tts.setRate(Number(e.target.value))} className="w-24 accent-primary" />
          <span className="text-xs text-muted-foreground">{tts.rate.toFixed(1)}x</span>
        </div>
      )}

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

        {searchOpen && (
          <SearchPanel
            visible={searchOpen}
            onClose={() => setSearchOpen(false)}
            getRendition={getRendition}
            book={getBookRef()}
          />
        )}

        {themeOpen && (
          <ThemeSettingsPanel
            visible={themeOpen}
            preferences={preferences}
            onChange={updatePreferences}
            onClose={() => setThemeOpen(false)}
          />
        )}

        <div ref={viewerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

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
        quickTemplates={QUICK_TEMPLATES}
        onQuickTemplate={(t) => { void handleQuickTemplate(t); }}
      />

      <CommentInput
        rect={selection?.rect ?? null}
        visible={commentMode}
        onSave={handleCommentSave}
        onCancel={handleCommentCancel}
      />

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
          onComment={(commentId) => {
            setCommentTargetHighlightId(commentId);
            setCommentMode(true);
            setEditing(null);
          }}
          onAddToTopic={(topicId) => {
            setTopicHighlightId(topicId);
            setEditing(null);
          }}
          onDelete={(deleteId) => {
            deleteHighlight.mutate(deleteId);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
