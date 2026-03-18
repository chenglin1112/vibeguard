import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SnapshotEngine } from '../../src/snapshot/engine.js';
import { SimpleGitAdapter } from '../../src/snapshot/git-adapter.js';
import { DEFAULT_CONFIG, VIBEGUARD_PREFIX } from '@vibeguard/shared';

describe('SnapshotEngine', () => {
  let tempDir: string;
  let gitAdapter: SimpleGitAdapter;
  let engine: SnapshotEngine;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vibeguard-test-'));
    gitAdapter = new SimpleGitAdapter(tempDir);
    await gitAdapter.init();

    const simpleGit = (await import('simple-git')).default;
    const git = simpleGit(tempDir);
    await git.addConfig('user.email', 'test@vibeguard.dev');
    await git.addConfig('user.name', 'VibeGuard Test');

    engine = new SnapshotEngine({
      gitAdapter,
      config: DEFAULT_CONFIG.snapshot,
      projectRoot: tempDir,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with changed files', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'hello');
      const result = await engine.createSnapshot('test snapshot');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toHaveLength(7);
        expect(result.data.message).toContain('test snapshot');
      }
    });

    it('should use [vibeguard] prefix in commit message', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'hello');
      await engine.createSnapshot('test');

      const logResult = await gitAdapter.log({ maxCount: 1 });
      expect(logResult.ok).toBe(true);
      if (logResult.ok) {
        expect(logResult.data[0].message).toContain(VIBEGUARD_PREFIX);
      }
    });

    it('should return error when no changes exist', async () => {
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await engine.createSnapshot('init');

      const result = await engine.createSnapshot();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NO_CHANGES');
        expect(result.error.suggestion).toBeDefined();
      }
    });

    it('should include file paths in snapshot', async () => {
      await writeFile(join(tempDir, 'a.txt'), 'a');
      await writeFile(join(tempDir, 'b.txt'), 'b');
      const result = await engine.createSnapshot();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesChanged.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('listSnapshots', () => {
    it('should list only vibeguard-prefixed commits', async () => {
      await writeFile(join(tempDir, 'a.txt'), 'a');
      await engine.createSnapshot('first');
      await writeFile(join(tempDir, 'b.txt'), 'b');
      await engine.createSnapshot('second');

      const result = await engine.listSnapshots();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].message).toContain('second');
      }
    });

    it('should respect limit parameter', async () => {
      await writeFile(join(tempDir, 'a.txt'), 'a');
      await engine.createSnapshot('first');
      await writeFile(join(tempDir, 'b.txt'), 'b');
      await engine.createSnapshot('second');

      const result = await engine.listSnapshots({ limit: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBe(1);
      }
    });

    it('should return empty array when no vibeguard commits exist', async () => {
      // git log fails on a repo with zero commits, so create a non-vibeguard
      // commit first to isolate what we're actually testing: the prefix filter.
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(tempDir);
      await writeFile(join(tempDir, 'readme.txt'), 'readme');
      await git.add('.');
      await git.commit('Initial commit (not vibeguard)');

      const result = await engine.listSnapshots();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('rollbackTo', () => {
    it('should restore files to snapshot state', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'version 1');
      const snap1 = await engine.createSnapshot('v1');
      expect(snap1.ok).toBe(true);

      await writeFile(join(tempDir, 'file.txt'), 'version 2');
      await engine.createSnapshot('v2');

      if (snap1.ok) {
        const rollback = await engine.rollbackTo(snap1.data.id);
        expect(rollback.ok).toBe(true);

        const { readFile: rf } = await import('node:fs/promises');
        const content = await rf(join(tempDir, 'file.txt'), 'utf-8');
        expect(content).toBe('version 1');
      }
    });

    it('should return error for non-existent snapshot', async () => {
      // Need at least one commit so git log doesn't fail on empty repo
      await writeFile(join(tempDir, 'seed.txt'), 'seed');
      await engine.createSnapshot('seed');

      const result = await engine.rollbackTo('aaaaaaa');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SNAPSHOT_NOT_FOUND');
      }
    });
  });

  describe('getSnapshotDiff', () => {
    it('should return diff for a snapshot', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'initial');
      await engine.createSnapshot('init');
      await writeFile(join(tempDir, 'file.txt'), 'modified content');
      const snap2 = await engine.createSnapshot('modify');

      if (snap2.ok) {
        const diff = await engine.getSnapshotDiff(snap2.data.id);
        expect(diff.ok).toBe(true);
        if (diff.ok) {
          expect(diff.data.changes.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getPendingChanges', () => {
    it('should return empty when no pending changes', async () => {
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await engine.createSnapshot('init');

      const result = await engine.getPendingChanges();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBe(0);
      }
    });

    it('should detect uncommitted file changes', async () => {
      await writeFile(join(tempDir, 'init.txt'), 'init');
      await engine.createSnapshot('init');
      await writeFile(join(tempDir, 'new.txt'), 'new');

      const result = await engine.getPendingChanges();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });
});
