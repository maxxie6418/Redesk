import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function parseJsonPairs(json: string): KeyValuePair[] {
  if (!json.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([key, val]) => ({
        key,
        value: String(val),
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

function serializePairs(pairs: KeyValuePair[]): string {
  const filtered = pairs.filter((p) => p.key.trim());
  if (filtered.length === 0) return '';
  const obj: Record<string, string> = {};
  for (const p of filtered) {
    obj[p.key.trim()] = p.value;
  }
  return JSON.stringify(obj);
}

export function KeyValueEditor({ value, onChange, className }: KeyValueEditorProps) {
  const [pairs, setPairs] = useState<KeyValuePair[]>(() => parseJsonPairs(value));

  useEffect(() => {
    setPairs(parseJsonPairs(value));
  }, [value]);

  const updatePair = useCallback(
    (index: number, field: 'key' | 'value', val: string) => {
      setPairs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: val };
        onChange(serializePairs(next));
        return next;
      });
    },
    [onChange],
  );

  const removePair = useCallback(
    (index: number) => {
      setPairs((prev) => {
        const next = prev.filter((_, i) => i !== index);
        onChange(serializePairs(next));
        return next;
      });
    },
    [onChange],
  );

  const addPair = useCallback(() => {
    setPairs((prev) => {
      const next = [...prev, { key: '', value: '' }];
      return next;
    });
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(i, 'key', e.target.value)}
            placeholder="属性名"
            className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(i, 'value', e.target.value)}
            placeholder="属性值"
            className="h-8 flex-[1.5] rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => removePair(i)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        添加属性
      </button>
      {pairs.length === 0 && !value.trim() && (
        <p className="text-xs text-muted-foreground/70">自定义收藏信息，以键值对形式存储</p>
      )}
    </div>
  );
}
