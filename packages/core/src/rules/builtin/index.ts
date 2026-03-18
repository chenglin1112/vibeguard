import type { Rule } from 'vibeguard-shared';
import { noCircularDeps } from './no-circular-deps.js';
import { noCrossLayerImports } from './no-cross-layer-imports.js';
import { singleResponsibility } from './single-responsibility.js';
import { noHardcodedSecrets } from './no-hardcoded-secrets.js';
import { noDuplicateLogic } from './no-duplicate-logic.js';
import { maxComplexity } from './max-complexity.js';
import { noDeepNesting } from './no-deep-nesting.js';
import { consistentNaming } from './consistent-naming.js';
import { noGodFile } from './no-god-file.js';
import { dependencyDirection } from './dependency-direction.js';

export {
  noCircularDeps,
  noCrossLayerImports,
  singleResponsibility,
  noHardcodedSecrets,
  noDuplicateLogic,
  maxComplexity,
  noDeepNesting,
  consistentNaming,
  noGodFile,
  dependencyDirection,
};

export const allBuiltinRules: Rule[] = [
  noCircularDeps,
  noCrossLayerImports,
  singleResponsibility,
  noHardcodedSecrets,
  noDuplicateLogic,
  maxComplexity,
  noDeepNesting,
  consistentNaming,
  noGodFile,
  dependencyDirection,
];
