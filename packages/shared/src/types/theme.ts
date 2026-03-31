/**
 * @summary Optional capabilities a theme may request.
 *
 * @remarks
 * - `'network'`: Allows `fetch()` inside the theme webview's CSP.
 * - `'audio'`: Allows use of the Web Audio API.
 * All other APIs (Node.js, IPC, filesystem) are never available in themes.
 */
export type ThemePermission = 'network' | 'audio';

/**
 * @summary The parsed and validated contents of a theme's `theme.json` file.
 *
 * @remarks
 * The `id` field uses reverse-DNS notation (e.g. `"com.author.theme-name"`) to
 * avoid collisions in a shared theme directory.
 */
export interface ThemeManifest {
  /** @summary Reverse-DNS theme identifier. E.g. `"com.yourname.minimal"`. */
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  /** @summary Path to the theme's HTML entry point, relative to the theme directory. */
  entrypoint: string;
  /** @summary Minimum Cufflinks app version required to run this theme. */
  minAppVersion?: string;
  /** @summary Optional capabilities this theme requires. Validated against an allowlist. */
  permissions?: ThemePermission[];
  defaultSize: { width: number; height: number };
  /** @summary Whether the user can resize the widget window when this theme is active. */
  resizable?: boolean;
}
