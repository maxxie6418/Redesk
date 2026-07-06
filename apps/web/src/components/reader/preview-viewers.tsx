import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { normalizeFileFormat } from '@redesk/shared';
import { Button } from '@/components/ui/button';

interface PreviewViewerProps {
  url: string;
  title: string;
  format: string;
  filename?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const list = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return html.join('\n');
}

export function TextPreviewViewer({ url, title, format, filename }: PreviewViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeFileFormat(format);
  const isMarkdown = normalized === 'MD' || normalized === 'MARKDOWN';
  const html = useMemo(() => (isMarkdown ? markdownToHtml(content) : ''), [content, isMarkdown]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('文件读取失败');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '文件读取失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <PreviewError message={error} url={url} />;
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f8f2e8] px-4 py-8 dark:bg-background sm:px-8">
      <article className="mx-auto min-h-full max-w-3xl rounded-2xl border border-border bg-background px-6 py-8 shadow-sm sm:px-10">
        <div className="mb-8 flex items-center gap-3 border-b border-border pb-4">
          <FileText className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">{filename ?? normalized}</p>
          </div>
        </div>
        {isMarkdown ? (
          <div
            className="prose prose-stone max-w-none text-[15px] leading-8 text-foreground dark:prose-invert prose-headings:font-display prose-h1:text-2xl prose-h2:text-xl prose-p:my-4 prose-ul:my-4 prose-li:my-1 prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-serif text-[16px] leading-8 text-foreground">{content}</pre>
        )}
      </article>
    </div>
  );
}

export function PdfPreviewViewer({ url, title, filename }: PreviewViewerProps) {
  return (
    <div className="flex h-full flex-col bg-muted/20">
      <PreviewHeader icon={<FileText className="h-4 w-4" />} title={title} subtitle={filename ?? 'PDF 预览'} url={url} />
      <iframe title={title} src={url} className="h-full w-full flex-1 border-0 bg-background" />
    </div>
  );
}

export function ImagePreviewViewer({ url, title, filename }: PreviewViewerProps) {
  return (
    <div className="flex h-full flex-col bg-[#171412]">
      <PreviewHeader icon={<ImageIcon className="h-4 w-4" />} title={title} subtitle={filename ?? '图片预览'} url={url} dark />
      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <img src={url} alt={title} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
      </div>
    </div>
  );
}

export function UnsupportedPreviewViewer({ url, format }: { url: string; format: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-foreground">暂不支持在线预览 {normalizeFileFormat(format) || '该'} 格式</p>
        <p className="mt-2 text-sm text-muted-foreground">你可以先下载原始文件后用本地应用打开。</p>
      </div>
      <Button asChild>
        <a href={url} download>
          <Download className="mr-2 h-4 w-4" />
          下载文件
        </a>
      </Button>
    </div>
  );
}

function PreviewHeader({ icon, title, subtitle, url, dark = false }: { icon: React.ReactNode; title: string; subtitle: string; url: string; dark?: boolean }) {
  return (
    <div className={dark ? 'flex h-12 items-center gap-3 border-b border-white/10 bg-black/30 px-4 text-white' : 'flex h-12 items-center gap-3 border-b border-border bg-background px-4'}>
      <span className={dark ? 'text-white/70' : 'text-primary'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className={dark ? 'truncate text-xs text-white/50' : 'truncate text-xs text-muted-foreground'}>{subtitle}</p>
      </div>
      <Button variant={dark ? 'secondary' : 'outline'} size="sm" asChild>
        <a href={url} download>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          下载
        </a>
      </Button>
    </div>
  );
}

function PreviewError({ message, url }: { message: string; url: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" asChild>
        <a href={url} download>
          <Download className="mr-2 h-4 w-4" />
          下载文件
        </a>
      </Button>
    </div>
  );
}
