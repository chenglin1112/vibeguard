import simpleGit, { type SimpleGit } from 'simple-git';
import { ok, err, vibeError, ErrorCodes } from 'vibeguard-shared';
import type { GitAdapter, GitCommit, GitFileStatus, GitLogOptions, Result } from 'vibeguard-shared';

/**
 * Git adapter backed by `simple-git`.
 *
 * Wraps every operation in the Result pattern so callers never need try/catch.
 */
export class SimpleGitAdapter implements GitAdapter {
  private git: SimpleGit;

  constructor(projectRoot: string) {
    this.git = simpleGit(projectRoot);
  }

  /**
   * Initialise a new git repository.
   * @returns Result indicating success or failure
   */
  async init(): Promise<Result<void>> {
    try {
      await this.git.init();
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to initialize git: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Check whether the working directory is inside a git repository.
   * @returns true when inside a repo
   */
  async isRepo(): Promise<boolean> {
    return this.git.checkIsRepo();
  }

  /**
   * Stage files for the next commit.
   * @param files - paths to stage
   * @returns Result indicating success or failure
   */
  async add(files: string[]): Promise<Result<void>> {
    try {
      await this.git.add(files);
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to stage files: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Create a commit with the given message.
   * @param message - commit message
   * @returns Result containing the commit hash on success
   */
  async commit(message: string): Promise<Result<string>> {
    try {
      const result = await this.git.commit(message);
      return ok(result.commit);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to commit: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Read the git log.
   * @param options - optional filters (maxCount, from, to)
   * @returns Result containing an array of commits
   */
  async log(options?: GitLogOptions): Promise<Result<GitCommit[]>> {
    try {
      const log = await this.git.log(
        options?.maxCount ? { maxCount: options.maxCount } : undefined,
      );
      return ok(
        log.all.map(entry => ({
          hash: entry.hash,
          message: entry.message,
          date: entry.date,
          author: entry.author_name,
        })),
      );
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to read git log: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Produce a unified diff between two refs.
   * @param from - starting ref (omit for working-tree diff)
   * @param to - ending ref
   * @returns Result containing the raw diff string
   */
  async diff(from?: string, to?: string): Promise<Result<string>> {
    try {
      const args: string[] = [];
      if (from) args.push(from);
      if (to) args.push(to);
      const result = await this.git.diff(args);
      return ok(result);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to get diff: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Show a file at a given ref.
   * @param ref - git ref (commit hash, branch, tag)
   * @param path - file path relative to repo root
   * @returns Result containing the file contents
   */
  async show(ref: string, path: string): Promise<Result<string>> {
    try {
      const result = await this.git.show([`${ref}:${path}`]);
      return ok(result);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to show ${ref}:${path}: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Checkout a ref, optionally restoring specific paths.
   * @param ref - git ref to checkout
   * @param paths - optional list of file paths to checkout
   * @returns Result indicating success or failure
   */
  async checkout(ref: string, paths?: string[]): Promise<Result<void>> {
    try {
      if (paths && paths.length > 0) {
        await this.git.checkout([ref, '--', ...paths]);
      } else {
        await this.git.checkout(ref);
      }
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.ROLLBACK_FAILED,
        `Failed to checkout: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Stash uncommitted changes.
   * @returns Result indicating success or failure
   */
  async stash(): Promise<Result<void>> {
    try {
      await this.git.stash();
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to stash: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Pop the most recent stash entry.
   * @returns Result indicating success or failure
   */
  async stashPop(): Promise<Result<void>> {
    try {
      await this.git.stash(['pop']);
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to pop stash: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Get the name of the current branch.
   * @returns Result containing the branch name
   */
  async getCurrentBranch(): Promise<Result<string>> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return ok(branch.trim());
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to get current branch: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Get the status of all tracked and untracked files.
   * @returns Result containing an array of file statuses
   */
  async getStatus(): Promise<Result<GitFileStatus[]>> {
    try {
      const status = await this.git.status();
      const files: GitFileStatus[] = status.files.map(f => ({
        path: f.path,
        index: f.index ?? ' ',
        working_dir: f.working_dir,
      }));
      return ok(files);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.SNAPSHOT_FAILED,
        `Failed to get status: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }
}
