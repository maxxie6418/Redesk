import { useState, useCallback, useMemo } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { BOOK_STATUS_LABELS, VISIBILITY } from '@redesk/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { InlineTagManager } from '@/components/inline-tag-manager';
import { KeyValueEditor } from '@/components/key-value-editor';
import { cn } from '@/lib/utils';
import type { BookDetail } from '@/hooks/use-books';
import type { UpdateBookInput } from '@/hooks/use-books';
import type { CategoryItem } from '@/hooks/use-categories';
import type { TagItem } from '@/hooks/use-tags';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

interface BookEditFormProps {
  book: BookDetail;
  onSave: (data: UpdateBookInput) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  statusMessage: StatusMessage | null;
  personalCategories: CategoryItem[];
  genreCategories: CategoryItem[];
  allTags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem>;
}

interface FormState {
  title: string;
  author: string;
  subtitle: string;
  translator: string;
  originalTitle: string;
  pageCount: string;
  sourceUrl: string;
  status: string;
  visibility: string;
  categoryId: number | null;
  genreCategoryId: number | null;
  rating: number | null;
  readingPurpose: string;
  startedAt: string;
  finishedAt: string;
  tagIds: number[];
  customAttributes: string;
}

function toFormState(book: BookDetail): FormState {
  return {
    title: book.title,
    author: book.author ?? '',
    subtitle: book.subtitle ?? '',
    translator: book.translator ?? '',
    originalTitle: book.original_title ?? '',
    pageCount: book.page_count != null ? String(book.page_count) : '',
    sourceUrl: book.source_url ?? '',
    status: book.status,
    visibility: book.visibility,
    categoryId: book.category_id,
    genreCategoryId: book.genre_category_id,
    rating: book.rating,
    readingPurpose: book.reading_purpose ?? '',
    startedAt: book.started_at ? book.started_at.slice(0, 10) : '',
    finishedAt: book.finished_at ? book.finished_at.slice(0, 10) : '',
    tagIds: book.tag_ids,
    customAttributes: book.custom_attributes ?? '',
  };
}

function computeDirty(current: FormState, initial: FormState): boolean {
  if (current.title !== initial.title) return true;
  if (current.author !== initial.author) return true;
  if (current.subtitle !== initial.subtitle) return true;
  if (current.translator !== initial.translator) return true;
  if (current.originalTitle !== initial.originalTitle) return true;
  if (current.pageCount !== initial.pageCount) return true;
  if (current.sourceUrl !== initial.sourceUrl) return true;
  if (current.status !== initial.status) return true;
  if (current.visibility !== initial.visibility) return true;
  if (current.categoryId !== initial.categoryId) return true;
  if (current.genreCategoryId !== initial.genreCategoryId) return true;
  if (current.rating !== initial.rating) return true;
  if (current.readingPurpose !== initial.readingPurpose) return true;
  if (current.startedAt !== initial.startedAt) return true;
  if (current.finishedAt !== initial.finishedAt) return true;
  if (current.tagIds.length !== initial.tagIds.length) return true;
  if (current.tagIds.some((id, i) => id !== initial.tagIds[i])) return true;
  if (current.customAttributes !== initial.customAttributes) return true;
  return false;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="inline-block h-3.5 w-[3px] rounded-sm bg-primary" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayRating = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-1 pt-1">
      {[1, 2, 3, 4, 5].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(value === r ? null : r)}
          onMouseEnter={() => setHovered(r)}
          onMouseLeave={() => setHovered(null)}
          className={cn(
            'transition-transform duration-150',
            r <= displayRating ? 'text-[#f5c842]' : 'text-muted-foreground/40',
          )}
        >
          <Star className={cn('h-5 w-5 fill-current', r <= displayRating && 'hover:scale-110')} />
        </button>
      ))}
      {value != null && (
        <span className="ml-1.5 text-sm font-semibold text-foreground">{value}/5</span>
      )}
    </div>
  );
}

export function BookEditForm({
  book,
  onSave,
  onCancel,
  isPending,
  statusMessage,
  personalCategories,
  genreCategories,
  allTags,
  onCreateTag,
}: BookEditFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(book));
  const initial = useMemo(() => toFormState(book), [book]);
  const dirty = useMemo(() => computeDirty(form, initial), [form, initial]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleCancel = useCallback(() => {
    if (dirty) {
      const confirmed = window.confirm('有未保存的修改，确定放弃吗？');
      if (!confirmed) return;
    }
    onCancel();
  }, [dirty, onCancel]);

  const handleSave = useCallback(async () => {
    const data: UpdateBookInput = {
      title: form.title,
      author: form.author || null,
      subtitle: form.subtitle || null,
      translator: form.translator || null,
      original_title: form.originalTitle || null,
      page_count: form.pageCount ? Number(form.pageCount) : null,
      source_url: form.sourceUrl || null,
      status: form.status,
      visibility: form.visibility,
      category_id: form.categoryId,
      genre_category_id: form.genreCategoryId,
      rating: form.rating,
      reading_purpose: form.readingPurpose || null,
      tag_ids: form.tagIds,
      custom_attributes: form.customAttributes || null,
      started_at: form.startedAt ? new Date(form.startedAt).toISOString() : null,
      finished_at: form.finishedAt ? new Date(form.finishedAt).toISOString() : null,
    };
    await onSave(data);
  }, [form, onSave]);

  const addTag = useCallback(async (tagId: number) => {
    setForm((prev) => ({ ...prev, tagIds: [...prev.tagIds, tagId] }));
  }, []);

  const removeTag = useCallback(async (tagId: number) => {
    setForm((prev) => ({ ...prev, tagIds: prev.tagIds.filter((t) => t !== tagId) }));
  }, []);

  const handleCreateTag = useCallback(
    async (name: string): Promise<TagItem> => {
      const created = await onCreateTag(name);
      setForm((prev) => ({ ...prev, tagIds: [...prev.tagIds, created.id] }));
      return created;
    },
    [onCreateTag],
  );

  const labelClass = 'text-xs font-medium text-foreground';
  const inputClass = 'h-9';

  return (
    <div className="animate-in fade-in duration-200">
      {statusMessage && (
        <div
          className={cn(
            'mb-4 rounded-md px-4 py-2.5 text-sm',
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
          )}
        >
          {statusMessage.text}
        </div>
      )}

      {dirty && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          未保存
        </div>
      )}

      <div className="space-y-6">
        <FormSection title="基本信息">
          <div className="space-y-2">
            <Label className={labelClass}>
              书名 <span className="text-primary">*</span>
            </Label>
            <Input
              className={inputClass}
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>副标题</Label>
            <Input
              className={inputClass}
              value={form.subtitle}
              onChange={(e) => updateField('subtitle', e.target.value)}
              placeholder="可选"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>作者</Label>
              <Input
                className={inputClass}
                value={form.author}
                onChange={(e) => updateField('author', e.target.value)}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>译者</Label>
              <Input
                className={inputClass}
                value={form.translator}
                onChange={(e) => updateField('translator', e.target.value)}
                placeholder="可选"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>原作名</Label>
            <Input
              className={inputClass}
              value={form.originalTitle}
              onChange={(e) => updateField('originalTitle', e.target.value)}
              placeholder="可选"
            />
          </div>
        </FormSection>

        <FormSection title="出版信息">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>页数</Label>
              <Input
                className={inputClass}
                type="number"
                min="0"
                value={form.pageCount}
                onChange={(e) => updateField('pageCount', e.target.value)}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>来源链接</Label>
              <Input
                className={inputClass}
                type="url"
                value={form.sourceUrl}
                onChange={(e) => updateField('sourceUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="分类与状态">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>状态</Label>
              <Select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                {Object.entries(BOOK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>可见性</Label>
              <Select value={form.visibility} onChange={(e) => updateField('visibility', e.target.value)}>
                <option value={VISIBILITY.PRIVATE}>私密</option>
                <option value={VISIBILITY.PUBLIC}>公开</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>个人分类</Label>
              <Select
                value={form.categoryId ?? ''}
                onChange={(e) => updateField('categoryId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">未分类</option>
                {personalCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>常规分类</Label>
              <Select
                value={form.genreCategoryId ?? ''}
                onChange={(e) => updateField('genreCategoryId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">未分类</option>
                {genreCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>评分</Label>
            <RatingInput value={form.rating} onChange={(v) => updateField('rating', v)} />
          </div>
        </FormSection>

        <FormSection title="阅读信息">
          <div className="space-y-2">
            <Label className={labelClass}>阅读目的</Label>
            <Input
              className={inputClass}
              value={form.readingPurpose}
              onChange={(e) => updateField('readingPurpose', e.target.value)}
              placeholder="泛读 / 精读 / 参考 ..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>开始阅读时间</Label>
              <Input
                className={inputClass}
                type="date"
                value={form.startedAt}
                onChange={(e) => updateField('startedAt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>读完时间</Label>
              <Input
                className={inputClass}
                type="date"
                value={form.finishedAt}
                onChange={(e) => updateField('finishedAt', e.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="标签">
          <InlineTagManager
            selectedTagIds={form.tagIds}
            allTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onCreateTag={handleCreateTag}
          />
        </FormSection>

        <FormSection title="自定义属性">
          <KeyValueEditor
            value={form.customAttributes}
            onChange={(v) => updateField('customAttributes', v)}
          />
        </FormSection>
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-border pt-5">
        <button
          type="button"
          onClick={handleCancel}
          className="h-9 rounded-lg border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !form.title.trim()}
          className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
          {isPending ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
