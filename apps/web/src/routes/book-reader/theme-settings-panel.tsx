import { useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReaderPreferences } from '@redesk/shared';

const COLOR_SCHEMES: { key: ReaderPreferences['color_scheme']; label: string; bg: string; text: string }[] = [
  { key: 'default', label: '默认', bg: 'bg-background', text: 'text-foreground' },
  { key: 'sepia', label: '棕褐', bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]' },
  { key: 'green', label: '护眼绿', bg: 'bg-[#c7edcc]', text: 'text-[#1a3a1a]' },
  { key: 'dark', label: '深夜', bg: 'bg-[#1a1a1a]', text: 'text-[#e0e0e0]' },
];

const FONT_OPTIONS = [
  { value: 'serif', label: '衬线体' },
  { value: 'sans-serif', label: '无衬线体' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Noto Serif SC', label: 'Noto Serif SC' },
  { value: 'Noto Sans SC', label: 'Noto Sans SC' },
];

interface ThemeSettingsPanelProps {
  visible: boolean;
  preferences: ReaderPreferences;
  onChange: (patch: Partial<ReaderPreferences>) => void;
  onClose: () => void;
  customFontFiles?: { filename: string; url: string }[];
  onUploadFont?: (file: File) => void;
}

export function ThemeSettingsPanel({
  visible,
  preferences,
  onChange,
  onClose,
  customFontFiles,
  onUploadFont,
}: ThemeSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  return (
    <div className="absolute left-0 top-0 z-20 flex h-full w-72 flex-col border-r border-border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium">阅读设置</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* 配色方案 */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">配色方案</div>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_SCHEMES.map((scheme) => (
              <button
                key={scheme.key}
                type="button"
                onClick={() => onChange({ color_scheme: scheme.key })}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 transition-all ${
                  preferences.color_scheme === scheme.key
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-foreground/20'
                }`}
              >
                <div className={`h-6 w-6 rounded ${scheme.bg} border border-border/50`} />
                <span className="text-[10px] text-muted-foreground">{scheme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 字体选择 */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">字体</div>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={preferences.font_family}
            onChange={(e) => onChange({ font_family: e.target.value })}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {(customFontFiles ?? []).map((f) => (
              <option key={f.filename} value={f.filename.replace(/\.\w+$/, '')}>
                {f.filename.replace(/\.\w+$/, '')}
              </option>
            ))}
          </select>
        </div>

        {/* 字号 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">字号</span>
            <span className="text-xs text-muted-foreground">{preferences.font_size}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={28}
            step={2}
            value={preferences.font_size}
            onChange={(e) => onChange({ font_size: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        {/* 行距 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">行距</span>
            <span className="text-xs text-muted-foreground">{preferences.line_height.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={1.2}
            max={2.4}
            step={0.2}
            value={preferences.line_height}
            onChange={(e) => onChange({ line_height: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        {/* 上传字体 */}
        {onUploadFont && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">自定义字体</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
            >
              <Upload className="h-4 w-4" />
              上传字体文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".ttf,.otf,.woff2"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFont(file);
                e.currentTarget.value = '';
              }}
            />
            <div className="mt-1 text-[10px] text-muted-foreground/60">支持 .ttf / .otf / .woff2</div>
          </div>
        )}
      </div>
    </div>
  );
}
