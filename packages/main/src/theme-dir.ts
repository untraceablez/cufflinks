import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * @summary Root of the user-visible Cufflinks home directory.
 *
 * @remarks
 * Intentionally capitalized with no dot prefix so it is visible in file managers.
 * Platform paths:
 * - Windows: `C:\Users\<user>\Cufflinks\`
 * - macOS: `/Users/<user>/Cufflinks/`
 * - Linux: `/home/<user>/Cufflinks/`
 */
export const CUFFLINKS_HOME = path.join(os.homedir(), 'Cufflinks');

/** @summary User-facing themes directory where all theme folders live. */
export const THEMES_DIR = path.join(CUFFLINKS_HOME, 'themes');

/**
 * @summary Ensures the theme directory exists and copies bundled default themes
 * on first launch.
 *
 * @remarks
 * Called early in `app.whenReady()`, before any theme reads. Safe to call on
 * every launch — existing themes are never overwritten, preserving user edits.
 *
 * @throws {Error} If the directory cannot be created due to permissions.
 */
export async function initThemeDirectory(): Promise<void> {
  await fs.mkdir(THEMES_DIR, { recursive: true });

  const bundledThemesDir = path.join(process.resourcesPath, 'themes');

  let bundled: string[];
  try {
    bundled = await fs.readdir(bundledThemesDir);
  } catch {
    // Running in development without packaged resources — skip bundled copy
    return;
  }

  for (const themeName of bundled) {
    const dest = path.join(THEMES_DIR, themeName);
    try {
      await fs.access(dest);
      // Theme already exists — do not overwrite user edits
    } catch {
      await fs.cp(path.join(bundledThemesDir, themeName), dest, { recursive: true });
    }
  }
}

/**
 * @summary Resolves a theme-relative file path and asserts it does not escape
 * the theme's root directory.
 *
 * @remarks
 * All file access for theme assets must go through this function. It prevents
 * path traversal attacks where a malicious `theme.json` might reference
 * `../../credentials-enc.json` or similar.
 *
 * @param themeId - The theme's ID as declared in `theme.json`. Used to resolve
 *   the theme root under `~/Cufflinks/themes/`.
 * @param relativePath - A path relative to the theme root, e.g. `"index.html"`
 *   or `"assets/cover.png"`.
 * @returns The absolute, safe filesystem path.
 * @throws {Error} If `relativePath` resolves outside the theme root directory.
 */
export function safeThemePath(themeId: string, relativePath: string): string {
  const base = path.join(THEMES_DIR, themeId);
  const resolved = path.resolve(base, relativePath);
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`Path traversal attempt in theme '${themeId}': ${relativePath}`);
  }
  return resolved;
}
