import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ArchitectureAnalyzer } from '../../src/analyzer/architecture.js';

describe('ArchitectureAnalyzer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vibeguard-arch-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('buildDependencyGraph', () => {
    it('should build graph with correct nodes and imports', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'a.ts'),
        `import { bVal } from './b';\nexport const aVal = bVal + 1;\n`,
      );
      await writeFile(
        join(srcDir, 'b.ts'),
        `import { cVal } from './c';\nexport const bVal = cVal + 1;\n`,
      );
      await writeFile(join(srcDir, 'c.ts'), `export const cVal = 3;\n`);

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.buildDependencyGraph();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.files.size).toBe(3);

      const aNode = result.data.files.get('src/a.ts');
      expect(aNode).toBeDefined();
      expect(aNode!.imports).toHaveLength(1);
      expect(aNode!.imports[0].source).toBe('./b');

      const bNode = result.data.files.get('src/b.ts');
      expect(bNode).toBeDefined();
      expect(bNode!.imports).toHaveLength(1);
      expect(bNode!.imports[0].source).toBe('./c');

      const cNode = result.data.files.get('src/c.ts');
      expect(cNode).toBeDefined();
      expect(cNode!.imports).toHaveLength(0);
      expect(cNode!.exports).toContain('cVal');
    });
  });

  describe('findCircularDependencies', () => {
    it('should detect circular imports', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'a.ts'),
        `import { bVal } from './b';\nexport const aVal = 1;\n`,
      );
      await writeFile(
        join(srcDir, 'b.ts'),
        `import { cVal } from './c';\nexport const bVal = 2;\n`,
      );
      await writeFile(
        join(srcDir, 'c.ts'),
        `import { aVal } from './a';\nexport const cVal = 3;\n`,
      );

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.findCircularDependencies();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.length).toBeGreaterThan(0);
      const cycleFiles = result.data[0].cycle;
      expect(cycleFiles).toContain('src/a.ts');
      expect(cycleFiles).toContain('src/b.ts');
      expect(cycleFiles).toContain('src/c.ts');
    });

    it('should return empty array when no cycles exist', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'a.ts'),
        `import { bVal } from './b';\nexport const aVal = bVal;\n`,
      );
      await writeFile(join(srcDir, 'b.ts'), `export const bVal = 42;\n`);

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.findCircularDependencies();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toHaveLength(0);
    });
  });

  describe('findLayerViolations', () => {
    it('should detect cross-layer imports', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(join(srcDir, 'components'), { recursive: true });
      await mkdir(join(srcDir, 'db'), { recursive: true });

      await writeFile(
        join(srcDir, 'components', 'widget.ts'),
        `import { store } from '../db/store';\nexport const widget = store;\n`,
      );
      await writeFile(
        join(srcDir, 'db', 'store.ts'),
        `export const store = {};\n`,
      );

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.findLayerViolations([
        { name: 'ui', patterns: ['components/'], allowedDependencies: ['services'] },
        { name: 'data', patterns: ['db/'], allowedDependencies: [] },
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].fromLayer).toBe('ui');
      expect(result.data[0].toLayer).toBe('data');
    });
  });

  describe('analyzeFile', () => {
    it('should extract imports, exports, and line count', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      const content = [
        `import { helper } from './helper';`,
        `export const foo = 1;`,
        `export function bar() { return helper(); }`,
        ``,
      ].join('\n');
      await writeFile(join(srcDir, 'module.ts'), content);
      await writeFile(
        join(srcDir, 'helper.ts'),
        `export function helper() { return 42; }\n`,
      );

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.analyzeFile('src/module.ts');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.imports).toHaveLength(1);
      expect(result.data.imports[0].source).toBe('./helper');
      expect(result.data.exports).toContain('foo');
      expect(result.data.exports).toContain('bar');
      expect(result.data.lineCount).toBeGreaterThan(0);
    });

    it('should estimate complexity for nested control flow', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      const content = [
        `export function complex(x: number) {`,
        `  if (x > 0) {`,
        `    for (let i = 0; i < x; i++) {`,
        `      while (i > 1) {`,
        `        break;`,
        `      }`,
        `    }`,
        `  }`,
        `  return x;`,
        `}`,
        ``,
      ].join('\n');
      await writeFile(join(srcDir, 'complex.ts'), content);

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.analyzeFile('src/complex.ts');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // base(1) + if(1) + for(1) + while(1) = 4
      expect(result.data.complexity).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent project gracefully', async () => {
      const fakePath = join(tmpdir(), 'vibeguard-nonexistent-' + Date.now());
      const analyzer = new ArchitectureAnalyzer(fakePath);
      const result = await analyzer.buildDependencyGraph();

      // Glob against non-existent dir yields no files — returns ok with empty graph
      if (result.ok) {
        expect(result.data.files.size).toBe(0);
      } else {
        expect(result.error.code).toBeDefined();
      }
    });

    it('should handle project with no source files', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      const analyzer = new ArchitectureAnalyzer(tempDir);
      const result = await analyzer.buildDependencyGraph();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.files.size).toBe(0);
      expect(result.data.circularDependencies).toHaveLength(0);
    });
  });
});
