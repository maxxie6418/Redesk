import { BRUTE_FORCE_DEFAULTS } from '@redesk/shared';

interface BruteForceRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

interface BruteForceConfig {
  windowMs: number;
  maxAttempts: number;
  lockMs: number;
}

const store = new Map<string, BruteForceRecord>();

let config: BruteForceConfig = {
  windowMs: BRUTE_FORCE_DEFAULTS.WINDOW_MINUTES * 60 * 1000,
  maxAttempts: BRUTE_FORCE_DEFAULTS.MAX_ATTEMPTS,
  lockMs: BRUTE_FORCE_DEFAULTS.LOCK_MINUTES * 60 * 1000,
};

export function setBruteForceConfig(cfg: Partial<BruteForceConfig>): void {
  if (cfg.windowMs !== undefined) config.windowMs = cfg.windowMs;
  if (cfg.maxAttempts !== undefined) config.maxAttempts = cfg.maxAttempts;
  if (cfg.lockMs !== undefined) config.lockMs = cfg.lockMs;
}

export function resetBruteForceConfig(): void {
  config = {
    windowMs: BRUTE_FORCE_DEFAULTS.WINDOW_MINUTES * 60 * 1000,
    maxAttempts: BRUTE_FORCE_DEFAULTS.MAX_ATTEMPTS,
    lockMs: BRUTE_FORCE_DEFAULTS.LOCK_MINUTES * 60 * 1000,
  };
}

export interface BruteForceResult {
  allowed: boolean;
  lockedUntil?: number;
  remainingAttempts?: number;
}

export function checkBruteForce(key: string): BruteForceResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  if (record.lockedUntil > now) {
    return { allowed: false, lockedUntil: record.lockedUntil };
  }

  if (now - record.firstAttempt > config.windowMs) {
    store.delete(key);
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  const remaining = config.maxAttempts - record.attempts;
  return { allowed: remaining > 0, remainingAttempts: Math.max(0, remaining) };
}

export function recordFailedAttempt(key: string): BruteForceResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now - record.firstAttempt > config.windowMs) {
    store.set(key, { attempts: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  record.attempts += 1;

  if (record.attempts >= config.maxAttempts) {
    record.lockedUntil = now + config.lockMs;
    return { allowed: false, lockedUntil: record.lockedUntil };
  }

  return { allowed: true, remainingAttempts: config.maxAttempts - record.attempts };
}

export function resetBruteForce(key: string): void {
  store.delete(key);
}

export function getLockRemaining(key: string): number {
  const record = store.get(key);
  if (!record || record.lockedUntil <= Date.now()) return 0;
  return record.lockedUntil - Date.now();
}
