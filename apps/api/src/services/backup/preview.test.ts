import { describe, expect, it } from 'vitest';
import { createBackupPreview } from './preview';

describe('createBackupPreview', () => {
  it('uses system preset when no modules are selected', () => {
    const preview = createBackupPreview({}, {
      book_count: 12,
      note_count: 3,
      highlight_count: 4,
      topic_count: 2,
      module_counts: {},
      module_sizes: {},
    });

    expect(preview.selected_modules).toEqual(['settings.public']);
    expect(preview.modules.filter((module) => module.selected).map((module) => module.module_id)).toEqual([
      'settings.public',
    ]);
    expect(preview.book_count).toBe(12);
    expect(preview.note_count).toBe(3);
    expect(preview.highlight_count).toBe(4);
    expect(preview.topic_count).toBe(2);
  });

  it('summarizes selected sensitive and risky modules with warnings', () => {
    const preview = createBackupPreview(
      { modules: ['settings.public', 'settings.secrets', 'database.snapshot'] },
      {
        book_count: 0,
        note_count: 0,
        highlight_count: 0,
        topic_count: 0,
        module_counts: {
          'settings.public': 5,
          'settings.secrets': 2,
          'database.snapshot': 1,
        },
        module_sizes: {
          'settings.public': 100,
          'settings.secrets': 200,
          'database.snapshot': 1000,
        },
      },
    );

    expect(preview.estimated_size_bytes).toBe(1300);
    expect(preview.modules.find((module) => module.module_id === 'settings.secrets')).toMatchObject({
      selected: true,
      sensitive: true,
      risky: true,
      count: 2,
      size_bytes: 200,
    });
    expect(preview.warnings).toEqual([
      '已选择敏感配置模块，备份包可能包含外部服务密钥。',
      '已选择高风险恢复模块，恢复时需要二次确认。',
    ]);
  });
});
