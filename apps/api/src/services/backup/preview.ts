import type { BackupModuleId, BackupPreset, BackupPreviewRequestInput, BackupPreviewResponse } from '@redesk/shared';
import { BACKUP_MODULES } from './modules';
import { resolveBackupModules } from './presets';

export interface BackupPreviewStats {
  book_count: number;
  note_count: number;
  highlight_count: number;
  topic_count: number;
  module_counts: Partial<Record<BackupModuleId, number>>;
  module_sizes: Partial<Record<BackupModuleId, number>>;
}

export interface CreateBackupPreviewInput {
  preset?: BackupPreset;
  modules?: BackupModuleId[];
}

export function createBackupPreview(input: CreateBackupPreviewInput | BackupPreviewRequestInput, stats: BackupPreviewStats): BackupPreviewResponse {
  const selectedModules = resolveBackupModules(input);
  const selectedSet = new Set(selectedModules);
  const modules = BACKUP_MODULES.map((module) => {
    const selected = selectedSet.has(module.id);
    const warnings: string[] = [];
    if (selected && module.sensitive) warnings.push('包含敏感配置');
    if (selected && module.risky) warnings.push('恢复时需要二次确认');

    return {
      module_id: module.id,
      label: module.label,
      selected,
      default_selected: module.default_selected,
      sensitive: module.sensitive,
      risky: module.risky,
      count: stats.module_counts[module.id] ?? 0,
      size_bytes: stats.module_sizes[module.id] ?? 0,
      warnings,
    };
  });
  const selectedSummaries = modules.filter((module) => module.selected);
  const estimatedSize = selectedSummaries.reduce((sum, module) => sum + module.size_bytes, 0);
  const warnings: string[] = [];
  if (selectedSummaries.some((module) => module.sensitive)) {
    warnings.push('已选择敏感配置模块，备份包可能包含外部服务密钥。');
  }
  if (selectedSummaries.some((module) => module.risky)) {
    warnings.push('已选择高风险恢复模块，恢复时需要二次确认。');
  }

  return {
    preset: input.preset ?? null,
    modules,
    selected_modules: selectedModules,
    book_count: stats.book_count,
    note_count: stats.note_count,
    highlight_count: stats.highlight_count,
    topic_count: stats.topic_count,
    estimated_size_bytes: estimatedSize,
    warnings,
  };
}
