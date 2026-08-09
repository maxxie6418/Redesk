import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { BOOK_STATUS, BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { Button } from '@/components/ui/button';
import { ApiError, API_BASE, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCategories, type CategoryItem } from '@/hooks/use-categories';
import { useTags, type TagItem } from '@/hooks/use-tags';
import type { LinkBookMetadata } from './utils';
import { parseDoubanMetadata } from './utils';

export function CreateBookForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const personalCategories = useCategories('PERSONAL');
  const genreCategories = useCategories('GENRE');
  const tags = useTags();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishYear, setPublishYear] = useState('');
  const [translator, setTranslator] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [doubanRating, setDoubanRating] = useState('');
  const [metadataSource, setMetadataSource] = useState<'douban' | 'neodb' | 'manual'>('manual');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [genreCategoryId, setGenreCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>(BOOK_STATUS.COLLECTED);
  const [visibility, setVisibility] = useState<string>(VISIBILITY.PRIVATE);
  const [rating] = useState<number | null>(null);
  const [readingPurpose, setReadingPurpose] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataPasteOpen, setMetadataPasteOpen] = useState(false);
  const [metadataPasteText, setMetadataPasteText] = useState('');

  const toggleTag = useCallback((tagId: number) => {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }, []);

  const applyPastedMetadata = useCallback(() => {
    const parsed = parseDoubanMetadata(metadataPasteText);
    if (parsed.title) setTitle(parsed.title);
    if (parsed.author) setAuthor(parsed.author);
    if (parsed.translator) setTranslator(parsed.translator);
    if (parsed.publisher) setPublisher(parsed.publisher);
    if (parsed.publishYear) setPublishYear(parsed.publishYear);
    if (parsed.isbn) setIsbn(parsed.isbn);
    if (parsed.pageCount) setPageCount(parsed.pageCount);
    if (parsed.originalTitle) setOriginalTitle(parsed.originalTitle);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.coverUrl) setCoverUrl(parsed.coverUrl);
    if (parsed.doubanRating) setDoubanRating(parsed.doubanRating);
    setMetadataSource('douban');
    setMetadataPasteOpen(false);
  }, [metadataPasteText]);

  const applyLinkMetadata = useCallback((metadata: LinkBookMetadata) => {
    if (metadata.title) setTitle(metadata.title);
    if (metadata.author) setAuthor(metadata.author);
    if (metadata.translator) setTranslator(metadata.translator);
    if (metadata.publisher) setPublisher(metadata.publisher);
    if (metadata.publish_year != null) setPublishYear(String(metadata.publish_year));
    if (metadata.isbn) setIsbn(metadata.isbn);
    if (metadata.page_count != null) setPageCount(String(metadata.page_count));
    if (metadata.original_title) setOriginalTitle(metadata.original_title);
    if (metadata.description) setDescription(metadata.description);
    if (metadata.cover_url) setCoverUrl(metadata.cover_url);
    if (metadata.douban_rating != null) setDoubanRating(String(metadata.douban_rating));
    setMetadataSource(metadata.metadata_source);
    setSourceUrl(metadata.source_url);
  }, []);

  const fetchMetadataFromLink = useCallback(async () => {
    if (!sourceUrl.trim()) {
      setMetadataPasteOpen(true);
      return;
    }

    setError('');
    setFetchingMetadata(true);

    try {
      const metadata = await api.post<LinkBookMetadata>('/books/metadata/fetch', { source_url: sourceUrl.trim() });
      applyLinkMetadata(metadata);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}。也可以粘贴豆瓣文本导入。` : '获取失败，也可以粘贴豆瓣文本导入。');
      setMetadataPasteOpen(true);
    } finally {
      setFetchingMetadata(false);
    }
  }, [applyLinkMetadata, sourceUrl]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      setError('');
      setSubmitting(true);

      try {
        const parsedDoubanRating = doubanRating ? Number(doubanRating) : null;
        const externalRatingKey = metadataSource === 'neodb' ? 'neodb_rating' : 'douban_rating';
        const payload: Record<string, unknown> = {
          title,
          subtitle: subtitle || null,
          author: author || null,
          isbn: isbn || null,
          publisher: publisher || null,
          publish_year: publishYear ? Number(publishYear) : null,
          translator: translator || null,
          original_title: originalTitle || null,
          description: description || null,
          category_id: categoryId,
          genre_category_id: genreCategoryId,
          status,
          visibility,
          reading_purpose: readingPurpose || null,
          rating,
          metadata_source: metadataSource,
          source_url: sourceUrl || null,
          cover_url: coverUrl || null,
          custom_attributes:
            parsedDoubanRating != null && Number.isFinite(parsedDoubanRating) ? { [externalRatingKey]: parsedDoubanRating } : null,
          page_count: pageCount ? Number(pageCount) : null,
          tag_ids: tagIds,
        };

        if (selectedFile) {
          const form = new FormData();
          form.append('title', title);
          Object.entries(payload).forEach(([key, value]) => {
            if (value != null) {
              form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
          });
          form.append('file', selectedFile);

          const response = await fetch(`${API_BASE}/books`, {
            method: 'POST',
            credentials: 'include',
            body: form,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const apiError = (body as { error?: { message?: string } } | null)?.error;
            throw new Error(apiError?.message ?? '创建失败');
          }
        } else {
          await api.post('/books', payload);
        }

        await queryClient.invalidateQueries({ queryKey: ['books'] });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建失败，请稍后重试。');
      } finally {
        setSubmitting(false);
      }
    },
    [
      author,
      categoryId,
      coverUrl,
      description,
      doubanRating,
      genreCategoryId,
      isbn,
      metadataSource,
      onClose,
      originalTitle,
      pageCount,
      publishYear,
      publisher,
      queryClient,
      rating,
      readingPurpose,
      selectedFile,
      sourceUrl,
      status,
      subtitle,
      tagIds,
      title,
      translator,
      visibility,
    ],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-12" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-medium text-foreground">添加书籍</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-6 gap-y-4">
            <SectionDivider title="快速录入" />

            <FormField className="col-span-2" label="书名" required>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                placeholder="输入书名"
                className={fieldClassName}
              />
            </FormField>

            <FormField label="个人分类">
              <select value={categoryId ?? ''} onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)} className={fieldClassName}>
                <option value="">未分类</option>
                {personalCategories.data?.map((category: CategoryItem) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="页数" optional>
              <input type="number" value={pageCount} onChange={(event) => setPageCount(event.target.value)} placeholder="0" min="0" className={fieldClassName} />
            </FormField>

            <FormField className="col-span-2" label="书籍介绍链接" optional>
              <div className="flex gap-2">
                <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://douban.com/..." className={cn(fieldClassName, 'flex-1')} />
                <button
                  type="button"
                  onClick={fetchMetadataFromLink}
                  disabled={fetchingMetadata}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-[12px] font-medium text-muted-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                >
                  {fetchingMetadata ? '获取中' : '一键获取'}
                </button>
              </div>

              {coverUrl || doubanRating ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2 py-2">
                  {coverUrl ? <img src={coverUrl} alt="封面预览" className="h-14 w-10 rounded object-cover" /> : <div className="flex h-14 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">封面</div>}
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">已获取元数据</div>
                    {doubanRating ? <div>{metadataSource === 'neodb' ? 'NeoDB 评分' : '豆瓣评分'}：{doubanRating}</div> : null}
                    {coverUrl ? <div className="truncate">{coverUrl}</div> : null}
                  </div>
                </div>
              ) : null}
            </FormField>

            <FormField className="col-span-2" label="书籍简介" optional>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="输入书籍简介..." rows={3} className={cn(fieldClassName, 'resize-y py-2')} />
            </FormField>

            <div className="col-span-2">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 transition hover:border-primary hover:bg-primary/10">
                <div className="text-[13px] text-muted-foreground">点击或拖拽上传书籍文件</div>
                <div className="text-[11px] text-muted-foreground">支持 epub、pdf、mobi、txt、azw3、docx 等格式</div>
                <input
                  type="file"
                  accept=".epub,.pdf,.mobi,.txt,.azw3,.azw,.djvu,.docx,.fb2"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {selectedFile ? <p className="mt-2 text-xs text-muted-foreground">已选择：{selectedFile.name}</p> : null}
            </div>

            <SectionDivider title="详细信息（收录后可补充）" />

            <FormField className="col-span-2" label="副标题" optional>
              <input type="text" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="输入副标题" className={fieldClassName} />
            </FormField>
            <FormField label="作者" optional>
              <input type="text" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="作者姓名" className={fieldClassName} />
            </FormField>
            <FormField label="ISBN" optional>
              <input type="text" value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="978-..." className={fieldClassName} />
            </FormField>
            <FormField label="出版社" optional>
              <input type="text" value={publisher} onChange={(event) => setPublisher(event.target.value)} placeholder="出版社名称" className={fieldClassName} />
            </FormField>
            <FormField label="出版年" optional>
              <input type="number" value={publishYear} onChange={(event) => setPublishYear(event.target.value)} placeholder="2024" min="0" max="2100" className={fieldClassName} />
            </FormField>
            <FormField label="常规分类">
              <select value={genreCategoryId ?? ''} onChange={(event) => setGenreCategoryId(event.target.value ? Number(event.target.value) : null)} className={fieldClassName}>
                <option value="">未分类</option>
                {genreCategories.data?.map((category: CategoryItem) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="阅读状态">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClassName}>
                {Object.entries(BOOK_STATUS_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="可见性">
              <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className={fieldClassName}>
                <option value={VISIBILITY.PRIVATE}>私密</option>
                <option value={VISIBILITY.PUBLIC}>公开</option>
              </select>
            </FormField>
            <FormField label="阅读目的" optional>
              <input type="text" value={readingPurpose} onChange={(event) => setReadingPurpose(event.target.value)} placeholder="泛读 / 精读 / 参考..." className={fieldClassName} />
            </FormField>

            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-foreground">标签</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.data?.map((tag: TagItem) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[12px] transition-all',
                        active ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive dark:border-destructive/30 dark:bg-destructive/15">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}
          </form>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </div>
      </div>

      {metadataPasteOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={(event) => {
            event.stopPropagation();
            setMetadataPasteOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-medium text-foreground">粘贴豆瓣书籍信息</h3>
                <p className="mt-1 text-xs text-muted-foreground">会自动识别书名、作者、出版社、出版年、ISBN、页数等字段。</p>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => setMetadataPasteOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={metadataPasteText}
                onChange={(event) => setMetadataPasteText(event.target.value)}
                rows={12}
                placeholder="粘贴豆瓣条目信息..."
                className={cn(fieldClassName, 'h-auto py-2')}
              />
            </div>
            <div className="flex justify-end gap-2.5 border-t border-border px-5 py-4">
              <Button type="button" variant="outline" onClick={() => setMetadataPasteOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={applyPastedMetadata} disabled={!metadataPasteText.trim()}>
                填入表单
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormField({
  label,
  children,
  className,
  required,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
        {optional ? <span className="font-normal text-muted-foreground/60"> 可选</span> : null}
      </label>
      {children}
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

const fieldClassName =
  'h-9 w-full rounded-lg border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]';
