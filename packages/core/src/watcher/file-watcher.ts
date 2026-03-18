import { watch, type FSWatcher } from 'chokidar';
import type { SnapshotConfig } from '@vibeguard/shared';
import { DEFAULT_IGNORE } from '@vibeguard/shared';

/**
 * Debounced file-system watcher that batches change events and
 * invokes a callback with the list of changed relative paths.
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private running = false;
  private projectRoot: string;
  private config: SnapshotConfig;
  private onFilesChanged: (files: string[]) => void;
  private pendingFiles: Set<string> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: {
    projectRoot: string;
    config: SnapshotConfig;
    onFilesChanged: (files: string[]) => void;
  }) {
    this.projectRoot = options.projectRoot;
    this.config = options.config;
    this.onFilesChanged = options.onFilesChanged;
  }

  /**
   * Start watching for file changes under the project root.
   * Subsequent calls while already running are no-ops.
   */
  start(): void {
    if (this.running) return;

    const ignorePatterns = [
      ...DEFAULT_IGNORE,
      ...(this.config.ignore || []),
    ].map(p => (p.includes('*') ? p : `**/${p}/**`));

    this.watcher = watch(this.projectRoot, {
      ignored: [/(^|[/\\])\./,  ...ignorePatterns],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    const handler = (filePath: string): void => this.handleChange(filePath);
    this.watcher
      .on('add', handler)
      .on('change', handler)
      .on('unlink', handler);

    this.running = true;
  }

  /**
   * Stop watching and release all resources.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.running = false;
    this.pendingFiles.clear();
  }

  /**
   * Whether the watcher is currently active.
   * @returns true when watching
   */
  isRunning(): boolean {
    return this.running;
  }

  private handleChange(filePath: string): void {
    const relative = filePath.replace(this.projectRoot + '/', '');
    this.pendingFiles.add(relative);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const files = [...this.pendingFiles];
      this.pendingFiles.clear();
      if (files.length > 0) {
        this.onFilesChanged(files);
      }
    }, this.config.interval * 1000);
  }
}
