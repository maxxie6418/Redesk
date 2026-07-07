import { describe, expect, it } from 'vitest';
import {
  createReadingProgressSyncTracker,
  getReadingProgressSyncMessage,
  shouldShowReadingProgressSyncWarning,
} from './reading-progress-sync-core';

describe('reading progress sync tracker', () => {
  it('保存失败后允许同一位置重试，连续失败后显示轻量提示，成功后清除提示', () => {
    const tracker = createReadingProgressSyncTracker();

    expect(tracker.shouldSave('epubcfi(/6/2)', 18)).toBe(true);
    tracker.markFailure();

    expect(tracker.shouldSave('epubcfi(/6/2)', 18)).toBe(true);
    expect(shouldShowReadingProgressSyncWarning(tracker.getStatus())).toBe(false);

    tracker.markFailure();

    expect(shouldShowReadingProgressSyncWarning(tracker.getStatus())).toBe(true);
    expect(getReadingProgressSyncMessage(tracker.getStatus())).toBe('阅读进度暂未同步');

    tracker.markSuccess('epubcfi(/6/2)', 18);

    expect(shouldShowReadingProgressSyncWarning(tracker.getStatus())).toBe(false);
    expect(tracker.shouldSave('epubcfi(/6/2)', 18)).toBe(false);
  });
});
