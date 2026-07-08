import { useCallback, useState } from 'react';
import { Check, FolderTree, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryItem,
} from '@/hooks/use-categories';
import {
  useCreateTag,
  useDeleteTag,
  useTags,
  useUpdateTag,
  type TagItem,
} from '@/hooks/use-tags';
import type { StatusMessage } from './types';

export function PropertiesTab() {
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const tags = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [catShow, setCatShow] = useState(false);
  const [catName, setCatName] = useState('');
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catEditName, setCatEditName] = useState('');

  const [tagShow, setTagShow] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagEditId, setTagEditId] = useState<number | null>(null);
  const [tagEditName, setTagEditName] = useState('');

  const showToast = useCallback((m: StatusMessage) => {
    if (!m) return;
    if (m.type === 'error') toast.error(m.text);
    else if (m.type === 'warning') toast.warning(m.text);
    else toast.success(m.text);
  }, []);

  const handleCreateCat = useCallback(async () => {
    try { await createCategory.mutateAsync({ name: catName }); showToast({ type: 'info', text: '分类已创建' }); setCatShow(false); setCatName(''); }
    catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [catName, createCategory, showToast]);

  const handleUpdateCat = useCallback(async (id: number) => {
    try { await updateCategory.mutateAsync({ id, name: catEditName }); showToast({ type: 'info', text: '已更新' }); setCatEditId(null); }
    catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [catEditName, updateCategory, showToast]);

  const handleDeleteCat = useCallback(async (id: number) => {
    try { await deleteCategory.mutateAsync(id); showToast({ type: 'info', text: '分类已删除' }); }
    catch { showToast({ type: 'error', text: '删除失败' }); }
  }, [deleteCategory, showToast]);

  const handleCreateTag = useCallback(async () => {
    try { await createTag.mutateAsync({ name: tagName }); showToast({ type: 'info', text: '标签已创建' }); setTagShow(false); setTagName(''); }
    catch { showToast({ type: 'error', text: '创建失败' }); }
  }, [tagName, createTag, showToast]);

  const handleUpdateTag = useCallback(async (id: number) => {
    try { await updateTag.mutateAsync({ id, name: tagEditName }); showToast({ type: 'info', text: '已更新' }); setTagEditId(null); }
    catch { showToast({ type: 'error', text: '更新失败' }); }
  }, [tagEditName, updateTag, showToast]);

  const handleDeleteTag = useCallback(async (id: number) => {
    try { await deleteTag.mutateAsync(id); showToast({ type: 'info', text: '标签已删除' }); }
    catch { showToast({ type: 'error', text: '删除失败' }); }
  }, [deleteTag, showToast]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">分类</CardTitle>
            <p className="text-xs text-muted-foreground">管理书籍分类，一书一分类</p>
          </div>
          <Button size="sm" onClick={() => setCatShow(true)}><Plus className="mr-1.5 h-4 w-4" />新建</Button>
        </CardHeader>
        <CardContent>
          {categories.isError && <p className="text-sm text-muted-foreground">加载失败</p>}
          {categories.data && categories.data.length === 0 && !catShow && (
            <p className="text-sm text-muted-foreground">还没有分类</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {categories.data?.map((cat: CategoryItem) => (
              <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {catEditId === cat.id ? (
                    <div className="flex items-center gap-1">
                      <Input className="h-7 flex-1 text-xs" value={catEditName} onChange={(e) => setCatEditName(e.target.value)} />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateCat(cat.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCatEditId(null)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <p className="truncate text-sm font-medium text-foreground">{cat.name}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{cat.book_count} 本</p>
                </div>
                {catEditId !== cat.id && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setCatEditId(cat.id); setCatEditName(cat.name); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteCat(cat.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {catShow && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Input className="h-7 flex-1 text-xs" placeholder="分类名称" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateCat} disabled={createCategory.isPending}>创建</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCatShow(false)}>取消</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">标签</CardTitle>
            <p className="text-xs text-muted-foreground">管理书籍标签，一书可多标签</p>
          </div>
          <Button size="sm" onClick={() => setTagShow(true)}><Plus className="mr-1.5 h-4 w-4" />新建</Button>
        </CardHeader>
        <CardContent>
          {tags.isError && <p className="text-sm text-muted-foreground">加载失败</p>}
          {tags.data && tags.data.length === 0 && !tagShow && (
            <p className="text-sm text-muted-foreground">还没有标签</p>
          )}
          <div className="flex flex-wrap gap-2">
            {tags.data?.map((tag: TagItem) => (
              <div key={tag.id} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
                <Tags className="h-3 w-3 shrink-0 text-muted-foreground" />
                {tagEditId === tag.id ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-6 w-20 text-xs" value={tagEditName} onChange={(e) => setTagEditName(e.target.value)} />
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleUpdateTag(tag.id)}><Check className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setTagEditId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <>
                    <span className="max-w-[6ch] truncate text-sm font-medium text-foreground" title={tag.name}>
                      {tag.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({tag.book_count})</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setTagEditId(tag.id); setTagEditName(tag.name); }}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleDeleteTag(tag.id)}><Trash2 className="h-3 w-3" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
          {tagShow && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Input className="h-7 flex-1 text-xs" placeholder="标签名称" value={tagName} onChange={(e) => setTagName(e.target.value)} />
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateTag} disabled={createTag.isPending}>创建</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTagShow(false)}>取消</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
