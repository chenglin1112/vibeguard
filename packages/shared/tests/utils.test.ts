import { describe, it, expect } from 'vitest';
import { shortHash, pluralize, summarizeChanges } from '../src/utils.js';
import { ok, err, vibeError } from '../src/errors.js';

describe('utils', () => {
  describe('shortHash', () => {
    it('should return first 7 chars', () => {
      expect(shortHash('abcdefghijklmno')).toBe('abcdefg');
    });
  });

  describe('pluralize', () => {
    it('should return singular for count 1', () => {
      expect(pluralize(1, 'file')).toBe('file');
    });
    it('should return plural for count > 1', () => {
      expect(pluralize(3, 'file')).toBe('files');
    });
  });

  describe('summarizeChanges', () => {
    it('should format change summary', () => {
      const result = summarizeChanges(['a.ts', 'b.ts'], 10, 5);
      expect(result).toContain('2');
      expect(result).toContain('+10');
      expect(result).toContain('-5');
    });
  });
});

describe('errors', () => {
  describe('ok', () => {
    it('should create ok result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBe(42);
    });
  });

  describe('err', () => {
    it('should create error result', () => {
      const result = err(vibeError('TEST', 'msg', 'fix'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEST');
        expect(result.error.suggestion).toBe('fix');
      }
    });
  });
});
