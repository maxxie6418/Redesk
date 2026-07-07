import { useState } from 'react';
import type { NoteItem } from '@/hooks/use-notes';

interface ReaderNoteForm {
  title: string;
  content: string;
}

interface EditingReaderNote extends ReaderNoteForm {
  id: number;
}

interface NoteMutation<TInput> {
  mutate: (input: TInput, options?: { onSuccess?: () => void }) => void;
}

interface NotesQuery {
  refetch: () => void;
}

interface UseReaderNotesOptions {
  bookId: number;
  getCurrentCfi: () => string;
  notesQuery: NotesQuery;
  createNote: NoteMutation<{
    book_id: number;
    cfi?: string;
    title: string;
    content_markdown?: string;
  }>;
  updateNote: NoteMutation<{
    id: number;
    title?: string;
    content_markdown?: string;
  }>;
  deleteNote: NoteMutation<number>;
}

export function useReaderNotes({ bookId, getCurrentCfi, notesQuery, createNote, updateNote, deleteNote }: UseReaderNotesOptions) {
  const [noteForm, setNoteForm] = useState<ReaderNoteForm | null>(null);
  const [editingNote, setEditingNote] = useState<EditingReaderNote | null>(null);

  const handleOpenNoteForm = () => {
    const cfi = getCurrentCfi();
    if (!cfi) return;
    setNoteForm({ title: '', content: '' });
  };

  const handleSubmitNote = () => {
    if (!noteForm || !noteForm.title.trim()) return;
    const cfi = getCurrentCfi();
    createNote.mutate(
      {
        book_id: bookId,
        cfi: cfi || undefined,
        title: noteForm.title.trim(),
        content_markdown: noteForm.content.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNoteForm(null);
          notesQuery.refetch();
        },
      },
    );
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNote({
      id: note.id,
      title: note.title ?? '',
      content: note.content_markdown ?? '',
    });
  };

  const handleSubmitEditNote = () => {
    if (!editingNote) return;
    updateNote.mutate(
      {
        id: editingNote.id,
        title: editingNote.title.trim() || undefined,
        content_markdown: editingNote.content.trim() || undefined,
      },
      {
        onSuccess: () => {
          setEditingNote(null);
          notesQuery.refetch();
        },
      },
    );
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate(id, {
      onSuccess: () => notesQuery.refetch(),
    });
  };

  return {
    noteForm,
    editingNote,
    setNoteForm,
    setEditingNote,
    handleOpenNoteForm,
    handleSubmitNote,
    handleEditNote,
    handleSubmitEditNote,
    handleDeleteNote,
  };
}
