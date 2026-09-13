import type { BuildType } from './types.js';

/**
 * Resolves an environment variable with _PROD / _DEV fallback.
 * Checks process.env[key] or process.env[`${key}_${buildType}`].
 */
export function resolveEnvWithFallback(
  key: string,
  buildType: BuildType,
  defaultValue = '',
): string {
  return process.env[key] || process.env[`${key}_${buildType}`] || defaultValue;
}
