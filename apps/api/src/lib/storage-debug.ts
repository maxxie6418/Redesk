import { randomUUID } from 'node:crypto';
import { config } from '../config';

export function randomStorageToken(): string {
  return randomUUID();
}

export function storageDebug(message: string): void {
  if (config.isDev || config.logLevel === 'debug') {
    console.debug(message);
  }
}

export function storageError(message: string): void {
  console.error(message);
}
