import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchResult {
  cfi: string;
  excerpt: string;
}

interface SearchPanelProps {
  visible: boolean;
  onClose: () => void;
  getRendition: () => any;
  book: any;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightExcerpt(excerpt: string, query: string) {
  if (!query.trim()) return excerpt;
  const escaped = escapeRegex(query);
  const parts = excerpt.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/20 text-foreground">{part}</mark>
    ) : (
      part
    ),
  );
}

export function SearchPanel({ visible, onClose, getRendition, book }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !book) return;
    setSearching(true);
    setSearched(true);
    setResults([]);
    setActiveIndex(-1);
    try {
      const searchResults = await book.search(trimmed);
      setResults(searchResults);
      if (searchResults.length > 0) {
        setActiveIndex(0);
        const rendition = getRendition();
        rendition?.display(searchResults[0].cfi);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, book, getRendition]);

  const goToResult = useCallback(
    (index: number) => {
      if (index < 0 || index >= results.length) return;
      setActiveIndex(index);
      const rendition = getRendition();
      rendition?.display(results[index].cfi);
    },
    [results, getRendition],
  );

  const goPrev = useCallback(() => {
    if (results.length === 0) return;
    const nextIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
    goToResult(nextIndex);
  }, [results.length, activeIndex, goToResult]);

  const goNext = useCallback(() => {
    if (results.length === 0) return;
    const nextIndex = activeIndex >= results.length - 1 ? 0 : activeIndex + 1;
    goToResult(nextIndex);
  }, [results.length, activeIndex, goToResult]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute left-0 top-0 z-20 flex h-full w-72 flex-col border-r border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium">全文搜索</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-border p-3">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="输入关键词..."
              className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goPrev} disabled={results.length === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goNext} disabled={results.length === 0}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {searched ? '无匹配结果' : '输入关键词后按 Enter 搜索'}
          </div>
        ) : (
          <ul className="py-1">
            {results.map((item, index) => (
              <li key={item.cfi}>
                <button
                  type="button"
                  onClick={() => goToResult(index)}
                  className={`w-full px-4 py-2.5 text-left text-xs leading-relaxed hover:bg-muted ${
                    index === activeIndex ? 'bg-muted' : ''
                  }`}
                >
                  {highlightExcerpt(item.excerpt, query.trim())}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searched && (
        <div className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
          {results.length === 0 ? '无匹配结果' : `第 ${activeIndex + 1} / ${results.length} 个`}
        </div>
      )}
    </div>
  );
}
