import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigLoader } from '../../src/config/loader.js';
import { CONFIG_FILENAME, DEFAULT_CONFIG } from '@vibeguard/shared';

describe('ConfigLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vibeguard-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return default config when file does not exist', async () => {
      const result = await ConfigLoader.load(tempDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(1);
        expect(result.data.snapshot.enabled).toBe(true);
      }
    });

    it('should load and parse a valid YAML config', async () => {
      await writeFile(
        join(tempDir, CONFIG_FILENAME),
        'version: 1\nsnapshot:\n  enabled: false\n  interval: 60\n',
      );
      const result = await ConfigLoader.load(tempDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.snapshot.enabled).toBe(false);
        expect(result.data.snapshot.interval).toBe(60);
      }
    });

    it('should return error for invalid YAML', async () => {
      await writeFile(join(tempDir, CONFIG_FILENAME), '}{invalid yaml');
      const result = await ConfigLoader.load(tempDir);
      expect(result.ok).toBe(false);
    });

    it('should merge user config with defaults', async () => {
      await writeFile(
        join(tempDir, CONFIG_FILENAME),
        'version: 1\nsnapshot:\n  interval: 120\n',
      );
      const result = await ConfigLoader.load(tempDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.snapshot.interval).toBe(120);
        expect(result.data.snapshot.enabled).toBe(true);
        expect(result.data.health.complexity_threshold).toBe(15);
      }
    });
  });

  describe('createDefault', () => {
    it('should create a valid config file', async () => {
      const result = await ConfigLoader.createDefault(tempDir);
      expect(result.ok).toBe(true);

      const content = await readFile(join(tempDir, CONFIG_FILENAME), 'utf-8');
      expect(content).toContain('version: 1');
      expect(content).toContain('snapshot');
    });
  });

  describe('validate', () => {
    it('should accept a valid config object', () => {
      const result = ConfigLoader.validate({ version: 1 });
      expect(result.ok).toBe(true);
    });

    it('should reject non-object config', () => {
      const result = ConfigLoader.validate('not an object');
      expect(result.ok).toBe(false);
    });

    it('should reject invalid version type', () => {
      const result = ConfigLoader.validate({ version: 'abc' });
      expect(result.ok).toBe(false);
    });
  });

  describe('merge', () => {
    it('should deep merge user config with defaults', () => {
      const result = ConfigLoader.merge(
        { snapshot: { interval: 99 } } as any,
        DEFAULT_CONFIG as any,
      );
      expect(result.snapshot.interval).toBe(99);
      expect(result.snapshot.enabled).toBe(true);
    });
  });
});
