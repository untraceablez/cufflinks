import fs from 'fs/promises';
import type { Dirent } from 'node:fs';
import path from 'path';
import { THEMES_DIR } from './theme-dir.js';
import type { ThemeManifest } from '@cufflinks/shared';

/** @summary ThemeManifest extended with the resolved filesystem path to the theme directory. */
export interface ResolvedTheme extends ThemeManifest {
  /** @summary Absolute path to the theme's directory on disk. */
  _resolvedDir: string;
}

/**
 * @summary Validates a parsed theme manifest object, throwing on any schema violation.
 *
 * @param manifest - The object parsed from `theme.json`.
 * @throws {Error} If any required field is missing or has an invalid type.
 */
function validateThemeManifest(manifest: unknown): asserts manifest is ThemeManifest {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error('theme.json must be a JSON object');
  }
  const m = manifest as Record<string, unknown>;
  const required = ['id', 'name', 'version', 'author', 'entrypoint', 'defaultSize'] as const;
  for (const key of required) {
    if (!(key in m)) {
      throw new Error(`theme.json missing required field: '${key}'`);
    }
  }
  if (typeof m['id'] !== 'string' || !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(m['id'] as string)) {
    throw new Error(`theme.json 'id' must be reverse-DNS format, got: ${String(m['id'])}`);
  }
  if (m['permissions'] !== undefined && !Array.isArray(m['permissions'])) {
    throw new Error("theme.json 'permissions' must be an array if present");
  }
}

/**
 * @summary Scans THEMES_DIR and returns all valid theme manifests.
 *
 * @remarks
 * Malformed or missing `theme.json` files are logged as warnings and skipped —
 * they do not prevent other themes from loading. This is intentional: one broken
 * theme should not crash the theme list.
 *
 * @returns Array of validated manifests with their resolved directory paths.
 */
export async function discoverThemes(): Promise<ResolvedTheme[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(THEMES_DIR, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return [];
  }

  const dirs = entries.filter((e) => e.isDirectory());

  const results = await Promise.allSettled(
    dirs.map(async (dir): Promise<ResolvedTheme> => {
      const manifestPath = path.join(THEMES_DIR, dir.name, 'theme.json');
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      validateThemeManifest(parsed);
      return { ...parsed, _resolvedDir: path.join(THEMES_DIR, dir.name) };
    }),
  );

  const valid: ResolvedTheme[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      valid.push(result.value);
    } else {
      console.warn('[theme-loader] Skipped malformed theme:', result.reason);
    }
  }

  return valid;
}
