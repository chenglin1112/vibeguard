import { consola } from 'consola';
import type { Snapshot, FileChange, VibeGuardError } from 'vibeguard-shared';

export function success(message: string): void {
  consola.success(message);
}

export function warn(message: string): void {
  consola.warn(message);
}

export function error(err: VibeGuardError): void {
  consola.error(err.message);
  if (err.suggestion) {
    consola.info(`💡 ${err.suggestion}`);
  }
}

export function info(message: string): void {
  consola.info(message);
}

export function formatSnapshot(s: Snapshot): string {
  const time = new Date(s.timestamp).toLocaleTimeString();
  return `[${s.id}] ${time}  ${s.message}`;
}

export function formatFileChange(change: FileChange): string {
  const stats: string[] = [];
  if (change.additions > 0) stats.push(`+${change.additions}`);
  if (change.deletions > 0) stats.push(`-${change.deletions}`);
  const statsStr = stats.length > 0 ? ` (${stats.join(' ')})` : '';
  return `${change.type}: ${change.path}${statsStr}`;
}

export function printTiming(startMs: number): void {
  const elapsed = Date.now() - startMs;
  consola.info(`Done in ${elapsed}ms`);
}

export function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
