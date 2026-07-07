import { Archive, Highlighter, Sparkles, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailTab, DetailTabItem } from './types';

const DETAIL_TABS: DetailTabItem[] = [
  { id: 'archive', label: '档案', icon: Archive, tint: 'bg-[hsl(15,28%,91%)] text-[hsl(15,24%,38%)]' },
  { id: 'traces', label: '笔记', icon: Highlighter, tint: 'bg-[hsl(22,28%,91%)] text-[hsl(22,24%,38%)]' },
  { id: 'topics', label: '主题', icon: Tags, tint: 'bg-[hsl(8,28%,91%)] text-[hsl(8,24%,38%)]' },
  { id: 'ai', label: 'AI', icon: Sparkles, tint: 'bg-[hsl(28,28%,91%)] text-[hsl(28,24%,38%)]' },
];

interface BookDetailTabsProps {
  activeTab: DetailTab;
  editMode: boolean;
  onChange: (tab: DetailTab) => void;
  onEditModeChange: (editMode: boolean) => void;
}

export function BookDetailTabs({ activeTab, editMode, onChange, onEditModeChange }: BookDetailTabsProps) {
  return (
    <div className="absolute right-0 bottom-4 flex flex-col gap-2">
      {DETAIL_TABS.map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              onChange(tab.id);
              if (editMode) {
                onEditModeChange(false);
              }
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 rounded-l-lg py-2.5 transition-colors duration-150',
              'w-9',
              active ? 'mr-2 bg-primary text-primary-foreground shadow-md' : cn('hover:brightness-[0.97]', tab.tint),
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="[writing-mode:vertical-rl] text-[11px] font-semibold leading-none">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
