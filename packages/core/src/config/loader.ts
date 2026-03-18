import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { ok, err, vibeError, ErrorCodes, CONFIG_FILENAME, DEFAULT_CONFIG } from '@vibeguard/shared';
import type { VibeGuardConfig, Result } from '@vibeguard/shared';

/**
 * Loads, validates, and creates VibeGuard YAML config files.
 */
export class ConfigLoader {
  /**
   * Load config from the project root, returning defaults when the file
   * does not exist.
   * @param projectRoot - absolute path to the project directory
   * @returns Result containing the resolved VibeGuardConfig
   */
  static async load(projectRoot: string): Promise<Result<VibeGuardConfig>> {
    const configPath = join(projectRoot, CONFIG_FILENAME);
    try {
      const content = await readFile(configPath, 'utf-8');
      const parsed = parse(content);
      const validateResult = ConfigLoader.validate(parsed);
      if (!validateResult.ok) return validateResult;
      return ok(ConfigLoader.merge(parsed, DEFAULT_CONFIG as VibeGuardConfig));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return ok(DEFAULT_CONFIG as VibeGuardConfig);
      }
      return err(vibeError(
        ErrorCodes.CONFIG_PARSE_ERROR,
        `Failed to parse ${CONFIG_FILENAME}: ${e instanceof Error ? e.message : String(e)}`,
        `Check the YAML syntax in ${CONFIG_FILENAME}`,
      ));
    }
  }

  /**
   * Generate a default config file at the project root.
   * @param projectRoot - absolute path to the project directory
   * @returns Result indicating success or failure
   */
  static async createDefault(projectRoot: string): Promise<Result<void>> {
    const configPath = join(projectRoot, CONFIG_FILENAME);
    try {
      const yamlContent = stringify(DEFAULT_CONFIG, { indent: 2 });
      await writeFile(configPath, yamlContent, 'utf-8');
      return ok(undefined);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.CONFIG_INVALID,
        `Failed to create config file: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /**
   * Validate a raw parsed config object.
   * @param config - unknown value from YAML parse
   * @returns Result containing the config cast to VibeGuardConfig on success
   */
  static validate(config: unknown): Result<VibeGuardConfig> {
    if (typeof config !== 'object' || config === null) {
      return err(vibeError(ErrorCodes.CONFIG_INVALID, 'Config must be an object'));
    }
    const c = config as Record<string, unknown>;
    if (c.version !== undefined && typeof c.version !== 'number') {
      return err(vibeError(ErrorCodes.CONFIG_INVALID, 'Config version must be a number'));
    }
    return ok(config as VibeGuardConfig);
  }

  /**
   * Deep-merge user config with defaults (user values win).
   * @param userConfig - partial config from YAML
   * @param defaults - full default config
   * @returns The merged VibeGuardConfig
   */
  static merge(
    userConfig: Partial<VibeGuardConfig>,
    defaults: VibeGuardConfig,
  ): VibeGuardConfig {
    return {
      version: userConfig.version ?? defaults.version,
      snapshot: { ...defaults.snapshot, ...userConfig.snapshot },
      rules: {
        ...defaults.rules,
        ...userConfig.rules,
        custom: userConfig.rules?.custom ?? defaults.rules.custom,
      },
      health: { ...defaults.health, ...userConfig.health },
      mcp: { ...defaults.mcp, ...userConfig.mcp },
    };
  }
}
