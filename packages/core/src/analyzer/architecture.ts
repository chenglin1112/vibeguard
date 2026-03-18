import { Project, SyntaxKind, type SourceFile } from 'ts-morph';
import { resolve, relative, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { ok, err, vibeError, ErrorCodes } from 'vibeguard-shared';
import type {
  Result, DependencyGraph, FileNode, ImportInfo,
  CircularDependency, LayerViolation, LayerDefinition,
} from 'vibeguard-shared';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Static analysis of project architecture using ts-morph.
 *
 * Builds a dependency graph, detects circular dependencies,
 * and checks layer boundary violations.
 */
export class ArchitectureAnalyzer {
  private projectRoot: string;
  private tsMorphProject: Project | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
  }

  /** Build dependency graph by scanning all source files under src/. */
  async buildDependencyGraph(): Promise<Result<DependencyGraph>> {
    try {
      const project = this.getOrCreateProject();
      const sourceFiles = project.getSourceFiles();
      const files = new Map<string, FileNode>();

      for (const sf of sourceFiles) {
        const node = this.extractFileNode(sf);
        files.set(node.path, node);
      }

      const circularDependencies = this.detectCycles(files);
      return ok({ files, circularDependencies, layerViolations: [] });
    } catch (e) {
      return err(vibeError(
        ErrorCodes.ANALYSIS_FAILED,
        `Failed to build dependency graph: ${e instanceof Error ? e.message : String(e)}`,
        'Ensure the project has valid TypeScript/JavaScript source files',
      ));
    }
  }

  /** Detect circular dependencies using DFS cycle detection. */
  async findCircularDependencies(): Promise<Result<CircularDependency[]>> {
    const graphResult = await this.buildDependencyGraph();
    if (!graphResult.ok) return graphResult;
    return ok(graphResult.data.circularDependencies);
  }

  /** Check layer violations given layer definitions. */
  async findLayerViolations(layers: LayerDefinition[]): Promise<Result<LayerViolation[]>> {
    try {
      const graphResult = await this.buildDependencyGraph();
      if (!graphResult.ok) return graphResult;

      const { files } = graphResult.data;
      const violations: LayerViolation[] = [];

      for (const [filePath, node] of files) {
        const fromLayer = this.resolveLayer(filePath, layers);
        if (!fromLayer) continue;

        const layerDef = layers.find(l => l.name === fromLayer);
        if (!layerDef) continue;

        for (const imp of node.imports) {
          const resolvedImport = this.resolveImportPath(filePath, imp.source);
          if (!resolvedImport) continue;

          const toLayer = this.resolveLayer(resolvedImport, layers);
          if (!toLayer || toLayer === fromLayer) continue;

          if (!layerDef.allowedDependencies.includes(toLayer)) {
            violations.push({
              from: filePath,
              to: resolvedImport,
              fromLayer,
              toLayer,
              rule: 'no-cross-layer-imports',
            });
          }
        }
      }

      return ok(violations);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.ANALYSIS_FAILED,
        `Failed to find layer violations: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /** Analyze a single file — extract imports, exports, estimate complexity. */
  async analyzeFile(filePath: string): Promise<Result<FileNode>> {
    try {
      const project = this.getOrCreateProject();
      const absPath = resolve(this.projectRoot, filePath);
      let sf = project.getSourceFile(absPath);
      if (!sf) {
        sf = project.addSourceFileAtPath(absPath);
      }
      return ok(this.extractFileNode(sf));
    } catch (e) {
      return err(vibeError(
        ErrorCodes.ANALYSIS_FAILED,
        `Failed to analyze file ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  private getOrCreateProject(): Project {
    if (this.tsMorphProject) return this.tsMorphProject;

    const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      this.tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath });
    } else {
      this.tsMorphProject = new Project({
        compilerOptions: { allowJs: true },
      });
      const srcDir = join(this.projectRoot, 'src');
      const baseDir = existsSync(srcDir) ? srcDir : this.projectRoot;
      for (const ext of SOURCE_EXTENSIONS) {
        this.tsMorphProject.addSourceFilesAtPaths(join(baseDir, `**/*${ext}`));
      }
    }

    return this.tsMorphProject;
  }

  private extractFileNode(sf: SourceFile): FileNode {
    const absPath = sf.getFilePath();
    const relPath = relative(this.projectRoot, absPath);

    const imports: ImportInfo[] = sf.getImportDeclarations().map(decl => ({
      source: decl.getModuleSpecifierValue(),
      specifiers: decl.getNamedImports().map(n => n.getName()),
      isTypeOnly: decl.isTypeOnly(),
    }));

    const exports: string[] = [];
    for (const [name] of sf.getExportedDeclarations()) {
      exports.push(name);
    }

    const lineCount = sf.getEndLineNumber();
    const complexity = this.estimateComplexity(sf);

    return { path: relPath, imports, exports, complexity, lineCount };
  }

  private estimateComplexity(sf: SourceFile): number {
    let complexity = 1;
    const countKinds = [
      SyntaxKind.IfStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.SwitchStatement,
      SyntaxKind.CatchClause,
      SyntaxKind.ConditionalExpression,
    ];
    for (const kind of countKinds) {
      complexity += sf.getDescendantsOfKind(kind).length;
    }
    const text = sf.getFullText();
    const logicalOps = (text.match(/&&|\|\|/g) ?? []).length;
    complexity += logicalOps;
    return complexity;
  }

  private detectCycles(files: Map<string, FileNode>): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recursionStack.add(node);
      pathStack.push(node);

      const fileNode = files.get(node);
      if (fileNode) {
        for (const imp of fileNode.imports) {
          if (imp.isTypeOnly) continue;
          const resolved = this.resolveImportToGraphKey(node, imp.source, files);
          if (!resolved) continue;

          if (recursionStack.has(resolved)) {
            const cycleStart = pathStack.indexOf(resolved);
            if (cycleStart !== -1) {
              cycles.push({ cycle: [...pathStack.slice(cycleStart), resolved] });
            }
          } else if (!visited.has(resolved)) {
            dfs(resolved);
          }
        }
      }

      pathStack.pop();
      recursionStack.delete(node);
    };

    for (const key of files.keys()) {
      if (!visited.has(key)) {
        dfs(key);
      }
    }
    return cycles;
  }

  private resolveImportToGraphKey(
    fromFile: string, importSource: string, files: Map<string, FileNode>,
  ): string | undefined {
    if (importSource.startsWith('.')) {
      const dir = dirname(fromFile);
      const candidate = join(dir, importSource).replace(/\\/g, '/');
      for (const ext of ['', ...SOURCE_EXTENSIONS.map(e => e), '/index.ts', '/index.tsx', '/index.js']) {
        const withExt = candidate.replace(/\.(js|ts|tsx|jsx)$/, '') + ext;
        if (files.has(withExt)) return withExt;
      }
    }
    return undefined;
  }

  private resolveImportPath(fromFile: string, importSource: string): string | undefined {
    if (!importSource.startsWith('.')) return undefined;
    const dir = dirname(fromFile);
    return join(dir, importSource).replace(/\\/g, '/');
  }

  private resolveLayer(filePath: string, layers: LayerDefinition[]): string | undefined {
    const normalized = filePath.replace(/\\/g, '/');
    for (const layer of layers) {
      for (const pattern of layer.patterns) {
        if (normalized.includes(pattern.replace(/\/$/, ''))) {
          return layer.name;
        }
      }
    }
    return undefined;
  }
}
