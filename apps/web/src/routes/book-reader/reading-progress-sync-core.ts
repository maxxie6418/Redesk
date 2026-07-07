export interface ReadingProgressSyncStatus {
  failedAttempts: number;
  lastErrorAt: string | null;
}

export const INITIAL_READING_PROGRESS_SYNC_STATUS: ReadingProgressSyncStatus = {
  failedAttempts: 0,
  lastErrorAt: null,
};

const WARNING_FAILURE_THRESHOLD = 2;

function createProgressKey(cfi: string, percentage: number) {
  return `${cfi}:${percentage}`;
}

export function shouldShowReadingProgressSyncWarning(status: ReadingProgressSyncStatus) {
  return status.failedAttempts >= WARNING_FAILURE_THRESHOLD;
}

export function getReadingProgressSyncMessage(status: ReadingProgressSyncStatus) {
  return shouldShowReadingProgressSyncWarning(status) ? '阅读进度暂未同步' : null;
}

export function createReadingProgressSyncTracker() {
  let lastSuccessfulKey = '';
  let status = INITIAL_READING_PROGRESS_SYNC_STATUS;

  return {
    shouldSave(cfi: string, percentage: number) {
      return createProgressKey(cfi, percentage) !== lastSuccessfulKey;
    },
    markSuccess(cfi: string, percentage: number) {
      lastSuccessfulKey = createProgressKey(cfi, percentage);
      status = INITIAL_READING_PROGRESS_SYNC_STATUS;
      return status;
    },
    markFailure() {
      status = {
        failedAttempts: status.failedAttempts + 1,
        lastErrorAt: new Date().toISOString(),
      };
      return status;
    },
    reset() {
      lastSuccessfulKey = '';
      status = INITIAL_READING_PROGRESS_SYNC_STATUS;
      return status;
    },
    getStatus() {
      return status;
    },
  };
}
