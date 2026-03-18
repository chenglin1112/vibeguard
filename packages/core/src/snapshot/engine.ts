import {
  ok, err, vibeError, ErrorCodes,
  VIBEGUARD_PREFIX, shortHash, summarizeChanges,
} from 'vibeguard-shared';
import type {
  GitAdapter, Snapshot, SnapshotDiff, FileChange, DiffHunk,
  SnapshotConfig, SnapshotListOptions, Result,
} from 'vibeguard-shared';

/**
 * Core snapshot engine – create, list, diff, rollback, and compare snapshots.
 *
 * All mutations go through the injected {@link GitAdapter} so the engine
 * itself has no direct git/filesystem side-effects.
 */
export class SnapshotEngine {
  private gitAdapter: GitAdapter;
  private config: SnapshotConfig;
  private projectRoot: string;

  constructor(options: {
    gitAdapter: GitAdapter;
    config: SnapshotConfig;
    projectRoot: string;
  }) {
    this.gitAdapter = options.gitAdapter;
    this.config = options.config;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Create a snapshot of the current working-tree state.
   * @param message - optional human-readable label for the snapshot
   * @returns Result containing the created Snapshot
   */
  async createSnapshot(message?: string): Promise<Result<Snapshot>> {
    const isRepo = await this.gitAdapter.isRepo();
    if (!isRepo) {
      return err(vibeError(
        ErrorCodes.NOT_A_GIT_REPO,
        'Not a git repository',
        'Run vibeguard init to initialize',
      ));
    }

    const statusResult = await this.gitAdapter.getStatus();
    if (!statusResult.ok) return statusResult;

    const changedFiles = statusResult.data.filter(
      f => f.index !== ' ' || f.working_dir !== ' ',
    );
    if (changedFiles.length === 0) {
      return err(vibeError(
        ErrorCodes.NO_CHANGES,
        'No changes to snapshot',
        'Make some changes first, then create a snapshot',
      ));
    }

    const addResult = await this.gitAdapter.add(['.']);
    if (!addResult.ok) return addResult;

    const filePaths = changedFiles.map(f => f.path);
    const autoMessage = summarizeChanges(filePaths, 0, 0);
    const fullMessage = message
      ? `${VIBEGUARD_PREFIX} ${message}`
      : `${VIBEGUARD_PREFIX} ${autoMessage}`;

    const commitResult = await this.gitAdapter.commit(fullMessage);
    if (!commitResult.ok) return commitResult;

    const snapshot: Snapshot = {
      id: shortHash(commitResult.data),
      timestamp: Date.now(),
      message: message ?? autoMessage,
      filesChanged: filePaths,
      linesAdded: 0,
      linesDeleted: 0,
      parent: null,
    };

    return ok(snapshot);
  }

  /**
   * List snapshots (only vibeguard-prefixed commits).
   * @param options - optional pagination / filtering
   * @returns Result containing an array of Snapshots
   */
  async listSnapshots(options?: SnapshotListOptions): Promise<Result<Snapshot[]>> {
    const logResult = await this.gitAdapter.log({ maxCount: 100 });
    if (!logResult.ok) return logResult;

    let snapshots = logResult.data
      .filter(c => c.message.startsWith(VIBEGUARD_PREFIX))
      .map((c, i, arr) => ({
        id: shortHash(c.hash),
        timestamp: new Date(c.date).getTime(),
        message: c.message.replace(`${VIBEGUARD_PREFIX} `, ''),
        filesChanged: [] as string[],
        linesAdded: 0,
        linesDeleted: 0,
        parent: i < arr.length - 1 ? shortHash(arr[i + 1].hash) : null,
      }));

    if (options?.since) {
      const since = options.since;
      snapshots = snapshots.filter(s => s.timestamp >= since);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? snapshots.length;
    snapshots = snapshots.slice(offset, offset + limit);

    return ok(snapshots);
  }

  /**
   * Get the diff for a specific snapshot against its parent.
   * @param snapshotId - short or full hash of the snapshot
   * @returns Result containing the SnapshotDiff
   */
  async getSnapshotDiff(snapshotId: string): Promise<Result<SnapshotDiff>> {
    const logResult = await this.gitAdapter.log({ maxCount: 100 });
    if (!logResult.ok) return logResult;

    const commit = logResult.data.find(
      c => shortHash(c.hash) === snapshotId || c.hash.startsWith(snapshotId),
    );
    if (!commit) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_NOT_FOUND,
        `Snapshot ${snapshotId} not found`,
        'Run vibeguard list to see available snapshots',
      ));
    }

    const diffResult = await this.gitAdapter.diff(`${commit.hash}~1`, commit.hash);
    if (!diffResult.ok) return diffResult;

    const changes = parseDiff(diffResult.data);

    const snapshot: Snapshot = {
      id: shortHash(commit.hash),
      timestamp: new Date(commit.date).getTime(),
      message: commit.message.replace(`${VIBEGUARD_PREFIX} `, ''),
      filesChanged: changes.map(c => c.path),
      linesAdded: changes.reduce((sum, c) => sum + c.additions, 0),
      linesDeleted: changes.reduce((sum, c) => sum + c.deletions, 0),
      parent: null,
    };

    return ok({ snapshot, changes });
  }

  /**
   * Rollback to a specific snapshot.
   *
   * Creates a safety snapshot of the current state first, then checks out
   * files from the target commit and records a new "rollback" commit.
   *
   * @param snapshotId - short or full hash of the target snapshot
   * @returns Result containing the newly-created rollback Snapshot
   */
  async rollbackTo(snapshotId: string): Promise<Result<Snapshot>> {
    const logResult = await this.gitAdapter.log({ maxCount: 100 });
    if (!logResult.ok) return logResult;

    const commit = logResult.data.find(
      c => shortHash(c.hash) === snapshotId || c.hash.startsWith(snapshotId),
    );
    if (!commit) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_NOT_FOUND,
        `Snapshot ${snapshotId} not found`,
        'Run vibeguard list to see available snapshots',
      ));
    }

    // Safety snapshot of uncommitted work
    const statusResult = await this.gitAdapter.getStatus();
    if (
      statusResult.ok &&
      statusResult.data.some(f => f.index !== ' ' || f.working_dir !== ' ')
    ) {
      await this.gitAdapter.add(['.']);
      await this.gitAdapter.commit(
        `${VIBEGUARD_PREFIX} Safety snapshot before rollback to ${snapshotId}`,
      );
    }

    const checkoutResult = await this.gitAdapter.checkout(commit.hash, ['.']);
    if (!checkoutResult.ok) {
      return err(vibeError(
        ErrorCodes.ROLLBACK_FAILED,
        `Failed to rollback: ${checkoutResult.error.message}`,
      ));
    }

    const addResult = await this.gitAdapter.add(['.']);
    if (!addResult.ok) return addResult;

    const commitMessage = `${VIBEGUARD_PREFIX} Rollback to ${snapshotId}`;
    const commitResult = await this.gitAdapter.commit(commitMessage);
    if (!commitResult.ok) return commitResult;

    return ok({
      id: shortHash(commitResult.data),
      timestamp: Date.now(),
      message: `Rollback to ${snapshotId}`,
      filesChanged: [],
      linesAdded: 0,
      linesDeleted: 0,
      parent: snapshotId,
    });
  }

  /**
   * Compare two snapshots and return the diff between them.
   * @param fromId - short or full hash of the base snapshot
   * @param toId - short or full hash of the target snapshot
   * @returns Result containing the SnapshotDiff
   */
  async compareBetween(fromId: string, toId: string): Promise<Result<SnapshotDiff>> {
    const logResult = await this.gitAdapter.log({ maxCount: 200 });
    if (!logResult.ok) return logResult;

    const fromCommit = logResult.data.find(
      c => shortHash(c.hash) === fromId || c.hash.startsWith(fromId),
    );
    const toCommit = logResult.data.find(
      c => shortHash(c.hash) === toId || c.hash.startsWith(toId),
    );

    if (!fromCommit) {
      return err(vibeError(ErrorCodes.SNAPSHOT_NOT_FOUND, `Snapshot ${fromId} not found`));
    }
    if (!toCommit) {
      return err(vibeError(ErrorCodes.SNAPSHOT_NOT_FOUND, `Snapshot ${toId} not found`));
    }

    const diffResult = await this.gitAdapter.diff(fromCommit.hash, toCommit.hash);
    if (!diffResult.ok) return diffResult;

    const changes = parseDiff(diffResult.data);

    return ok({
      snapshot: {
        id: shortHash(toCommit.hash),
        timestamp: new Date(toCommit.date).getTime(),
        message: toCommit.message,
        filesChanged: changes.map(c => c.path),
        linesAdded: changes.reduce((sum, c) => sum + c.additions, 0),
        linesDeleted: changes.reduce((sum, c) => sum + c.deletions, 0),
        parent: fromId,
      },
      changes,
    });
  }

  /**
   * Get pending (uncommitted) changes in the working tree.
   * @returns Result containing an array of FileChange objects
   */
  async getPendingChanges(): Promise<Result<FileChange[]>> {
    const statusResult = await this.gitAdapter.getStatus();
    if (!statusResult.ok) return statusResult;

    const changes: FileChange[] = statusResult.data
      .filter(f => f.index !== ' ' || f.working_dir !== ' ')
      .map(f => ({
        path: f.path,
        type: f.working_dir === '?'
          ? 'added' as const
          : f.working_dir === 'D'
            ? 'deleted' as const
            : 'modified' as const,
        additions: 0,
        deletions: 0,
        hunks: [],
      }));

    return ok(changes);
  }
}

/** Parse unified diff output into FileChange[]. */
function parseDiff(diffOutput: string): FileChange[] {
  if (!diffOutput.trim()) return [];

  const files: FileChange[] = [];
  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split('\n');
    const headerMatch = lines[0]?.match(/a\/(.*?) b\/(.*)/);
    if (!headerMatch) continue;

    const path = headerMatch[2];
    let type: FileChange['type'] = 'modified';
    let additions = 0;
    let deletions = 0;
    const hunks: DiffHunk[] = [];

    if (section.includes('new file mode')) type = 'added';
    else if (section.includes('deleted file mode')) type = 'deleted';
    else if (section.includes('rename from')) type = 'renamed';

    const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;
    let currentHunk: DiffHunk | null = null;
    const hunkLines: string[] = [];

    for (const line of lines) {
      const hunkMatch = line.match(hunkRegex);
      if (hunkMatch) {
        if (currentHunk) {
          currentHunk.content = hunkLines.join('\n');
          hunks.push(currentHunk);
          hunkLines.length = 0;
        }
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] || '1', 10),
          content: '',
        };
      } else if (currentHunk) {
        hunkLines.push(line);
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }
    }
    if (currentHunk) {
      currentHunk.content = hunkLines.join('\n');
      hunks.push(currentHunk);
    }

    files.push({ path, type, additions, deletions, hunks });
  }

  return files;
}
