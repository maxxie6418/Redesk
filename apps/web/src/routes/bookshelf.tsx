import { BookPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Bookshelf() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium text-foreground">书架</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的藏书，记录每一本书的状态与归属</p>
      </header>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <BookPlus className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-display text-lg text-foreground">书架还是空的</p>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">添加你的第一本书，开始积累阅读经历</p>
        <Button disabled>添加书籍</Button>
      </div>
    </div>
  );
}
