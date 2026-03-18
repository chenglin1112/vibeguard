import type { Rule, RuleViolation } from 'vibeguard-shared';

const SECRET_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, label: 'hardcoded password' },
  { pattern: /apiKey\s*[:=]\s*['"][^'"]+['"]/gi, label: 'hardcoded API key' },
  { pattern: /api_key\s*[:=]\s*['"][^'"]+['"]/gi, label: 'hardcoded API key' },
  { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, label: 'hardcoded secret' },
  { pattern: /token\s*[:=]\s*['"][^'"]+['"]/gi, label: 'hardcoded token' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, label: 'private key' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
  { pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+/, label: 'JWT token' },
];

const IGNORE_PATTERNS = [/\.env/, /\.test\./, /\.spec\./, /__tests__/];

/** Scans file content for common secret/credential patterns. */
export const noHardcodedSecrets: Rule = {
  name: 'no-hardcoded-secrets',
  description: 'Detect hardcoded secrets and credentials',
  severity: 'error',
  async check(context): Promise<RuleViolation[]> {
    if (!context.filePath || !context.fileContent) return [];
    if (IGNORE_PATTERNS.some(p => p.test(context.filePath!))) return [];

    const violations: RuleViolation[] = [];
    const lines = context.fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, label } of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            rule: 'no-hardcoded-secrets',
            severity: 'error',
            message: `Possible ${label} found`,
            file: context.filePath,
            line: i + 1,
            suggestion: 'Move secrets to environment variables or a secure vault',
          });
        }
      }
    }
    return violations;
  },
};
