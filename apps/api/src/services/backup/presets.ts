import type { BackupModuleId, BackupPreset } from '@redesk/shared';
import { BACKUP_MODULE_ID_VALUES } from '@redesk/shared';

export const BACKUP_PRESETS = {
  system: ['settings.public'],
  books: ['library.books', 'library.taxonomy', 'library.relations', 'assets.file_index'],
  notes: [
    'library.books',
    'library.taxonomy',
    'assets.file_index',
    'reading.progress',
    'reading.highlights',
    'reading.notes',
    'reading.bookmarks',
  ],
  topics: [
    'library.books',
    'library.taxonomy',
    'assets.file_index',
    'reading.progress',
    'reading.highlights',
    'reading.notes',
    'reading.bookmarks',
    'topics.workspace',
  ],
  full: [...BACKUP_MODULE_ID_VALUES],
} satisfies Record<BackupPreset, BackupModuleId[]>;

export interface ResolveBackupModulesInput {
  preset?: BackupPreset | null;
  modules?: BackupModuleId[] | null;
}

export function resolveBackupModules(input: ResolveBackupModulesInput) {
  if (input.modules?.length) return [...new Set(input.modules)];
  return BACKUP_PRESETS[input.preset ?? 'system'];
}
