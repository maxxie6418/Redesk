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
}

export function useReaderKeyboardNavigation({ activeKey, getRendition }: UseReaderKeyboardNavigationOptions) {
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
  }, [activeKey, getRendition]);
}
