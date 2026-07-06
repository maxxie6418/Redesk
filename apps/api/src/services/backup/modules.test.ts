import { describe, expect, it } from 'vitest';
import { BACKUP_MODULE_ID_VALUES } from '@redesk/shared';
import { BACKUP_MODULES, getBackupModule } from './modules';

describe('BACKUP_MODULES', () => {
  it('defines every shared backup module exactly once', () => {
    const moduleIds = BACKUP_MODULES.map((module) => module.id);

    expect(moduleIds).toEqual([...BACKUP_MODULE_ID_VALUES]);
    expect(new Set(moduleIds).size).toBe(BACKUP_MODULE_ID_VALUES.length);
  });

  it('marks system settings as the only default selected module', () => {
    const defaultSelected = BACKUP_MODULES.filter((module) => module.default_selected).map((module) => module.id);

    expect(defaultSelected).toEqual(['settings.public']);
  });

  it('separates sensitive and risky modules from normal modules', () => {
    expect(getBackupModule('settings.public')).toMatchObject({ sensitive: false, risky: false });
    expect(getBackupModule('settings.secrets')).toMatchObject({ sensitive: true, risky: true });
    expect(getBackupModule('users.auth')).toMatchObject({ sensitive: true, risky: true });
    expect(getBackupModule('database.snapshot')).toMatchObject({ sensitive: false, risky: true });
  });
});
