import { useEffect } from 'react';

function shouldIgnoreKeydown(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.closest('[contenteditable="true"]') !== null
  );
}

interface KeyboardRendition {
  prev: () => void;
  next: () => void;
  hooks?: {
    content?: {
      register: (callback: (contents: { document: Document }) => void) => void;
    };
  };
}

interface UseReaderKeyboardNavigationOptions {
  activeKey: unknown;
  getRendition: () => KeyboardRendition | null;
  onToggleToc?: () => void;
  onToggleNotes?: () => void;
  onToggleSearch?: () => void;
  onToggleTheme?: () => void;
  onToggleFocus?: () => void;
  onBookmark?: () => void;
  onEscape?: () => void;
}

export function useReaderKeyboardNavigation({
  activeKey,
  getRendition,
  onToggleToc,
  onToggleNotes,
  onToggleSearch,
  onToggleTheme,
  onToggleFocus,
  onBookmark,
  onEscape,
}: UseReaderKeyboardNavigationOptions) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeydown(event.target)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        getRendition()?.prev();
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        getRendition()?.next();
      }
      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        onBookmark?.();
      }
      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        onToggleToc?.();
      }
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        onToggleNotes?.();
      }
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        onToggleSearch?.();
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        onToggleTheme?.();
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        onToggleFocus?.();
      }
      if (event.key === 'Escape') {
        onEscape?.();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    const rendition = getRendition();
    if (rendition?.hooks?.content) {
      rendition.hooks.content.register((contents) => {
        contents.document.addEventListener('keydown', handleKeydown);
      });
    }
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [activeKey, getRendition, onToggleToc, onToggleNotes, onToggleSearch, onToggleTheme, onToggleFocus, onBookmark, onEscape]);
}
