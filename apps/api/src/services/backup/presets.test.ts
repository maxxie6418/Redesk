import { describe, expect, it } from 'vitest';
import { BACKUP_MODULE_ID_VALUES, BACKUP_PRESET_VALUES } from '@redesk/shared';
import { BACKUP_PRESETS, resolveBackupModules } from './presets';

describe('BACKUP_PRESETS', () => {
  it('defines every shared backup preset exactly once', () => {
    expect(Object.keys(BACKUP_PRESETS)).toEqual([...BACKUP_PRESET_VALUES]);
  });

  it('uses full preset as all backup modules', () => {
    expect(BACKUP_PRESETS.full).toEqual([...BACKUP_MODULE_ID_VALUES]);
  });

  it('keeps system preset focused on public settings', () => {
    expect(BACKUP_PRESETS.system).toEqual(['settings.public']);
  });

  it('resolves explicit modules before preset modules', () => {
    expect(resolveBackupModules({ preset: 'full', modules: ['settings.public', 'reading.notes'] })).toEqual([
      'settings.public',
      'reading.notes',
    ]);
  });

  it('falls back to system preset when neither preset nor modules are provided', () => {
    expect(resolveBackupModules({})).toEqual(['settings.public']);
  });
});
