# CLAUDE.md — Cufflinks

## Project Overview

**Cufflinks** is a cross-platform desktop widget that renders at the desktop level (below application windows), displaying current track metadata — album art, song title, album name, and artist. It supports user-defined HTML/CSS/JS themes, scrobbles to Last.fm, and pulls now-playing state from Spotify, TIDAL, and Apple Music.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Desktop framework | **Electron 33+** | Consistent Chromium rendering across platforms; critical for reliable theme execution |
| Language | **TypeScript** (strict) | End-to-end across main + renderer + shared packages |
| Frontend (app shell) | **React 19 + Vite** | Settings UI, theme manager, onboarding |
| IPC | Electron `ipcMain` / `ipcRenderer` + `contextBridge` | Secure sandboxed communication |
| Styling (shell) | **CSS Modules + CSS custom properties** | Scoped shell styles; vars exposed to themes |
| State management | **Zustand** | Lightweight; works across renderer processes |
| Theme sandboxing | `<webview>` tag with `sandbox` attribute | Isolates user JS from app shell |
| Package manager | **pnpm workspaces** | Monorepo management |
| Build / release | **electron-builder** | NSIS (Windows), DMG (macOS), AppImage/deb (Linux) |
| Credential storage | **keytar** + `safeStorage` fallback | OS keychain (Credential Manager / Keychain / libsecret); safeStorage when keychain unavailable |
| Persistent settings | **electron-store** | Plain JSON for non-sensitive settings only |

---

## Monorepo Structure

```
cufflinks/
├── CLAUDE.md
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── electron-builder.config.ts
│
├── packages/
│   ├── main/                     # Electron main process
│   │   ├── src/
│   │   │   ├── index.ts          # App entry, BrowserWindow setup
│   │   │   ├── desktop-layer/    # Per-platform desktop-level rendering
│   │   │   │   ├── index.ts      # Platform dispatcher
│   │   │   │   ├── windows.ts    # WorkerW / HWND_BOTTOM strategy
│   │   │   │   ├── macos.ts      # NSWindow level (kCGDesktopWindowLevel)
│   │   │   │   └── linux.ts      # _NET_WM_WINDOW_TYPE_DESKTOP hint
│   │   │   ├── sources/          # Music source plugins
│   │   │   │   ├── base.ts       # ISource interface + error classes
│   │   │   │   ├── _template.ts  # Annotated starter file for new sources
│   │   │   │   ├── spotify.ts
│   │   │   │   ├── tidal.ts
│   │   │   │   ├── apple-music.ts
│   │   │   │   ├── index.ts      # Re-exports all sources
│   │   │   │   └── manager.ts    # Priority polling / event fanout
│   │   │   ├── scrobbler/
│   │   │   │   ├── lastfm.ts     # Last.fm API client + scrobble queue
│   │   │   │   └── queue.ts      # Offline-tolerant scrobble queue (SQLite)
│   │   │   ├── credentials/
│   │   │   │   ├── index.ts      # CredentialStore — unified read/write/clear API
│   │   │   │   ├── keychain.ts   # OS keychain backends (Keytar wrapper)
│   │   │   │   └── fallback.ts   # safeStorage fallback when keychain unavailable
│   │   │   ├── tray.ts           # System tray icon + context menu
│   │   │   ├── ipc/
│   │   │   │   ├── handlers.ts   # ipcMain handlers
│   │   │   │   └── channels.ts   # Shared channel name constants
│   │   │   └── store.ts          # electron-store (persistent settings)
│   │   └── package.json
│   │
│   ├── renderer/                 # Electron renderer — app shell (React)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── views/
│   │   │   │   ├── Settings/
│   │   │   │   ├── ThemeManager/
│   │   │   │   └── Auth/         # Spotify OAuth, Last.fm auth
│   │   │   ├── components/
│   │   │   └── store/            # Zustand slices
│   │   └── package.json
│   │
│   ├── widget/                   # Electron renderer — transparent widget window
│   │   ├── src/
│   │   │   ├── main.tsx          # Mounts <ThemeHost>
│   │   │   └── ThemeHost.tsx     # <webview> wrapper + CSS var injection
│   │   └── package.json
│   │
│   └── shared/                   # Types, constants, utilities shared across packages
│       ├── src/
│       │   ├── types/
│       │   │   ├── track.ts      # TrackMetadata interface
│       │   │   ├── theme.ts      # ThemeManifest interface
│       │   │   └── source.ts     # SourceState, SourceStatus enums
│       │   └── ipc-channels.ts
│       └── package.json
│
├── themes/                       # Bundled default themes (copied to ~/Cufflinks/themes on first launch)
│   ├── minimal/
│   │   ├── theme.json            # ThemeManifest
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── glassmorphic/
│       └── ...
│
└── resources/                    # Static assets for electron-builder
    ├── icon.icns
    ├── icon.ico
    └── icon.png

docs/
├── theme-authoring.md            # End-user guide for writing themes
├── contributing.md               # Links back to CLAUDE.md; PR checklist
└── sources/                      # One file per implemented source
    ├── spotify.md                # Setup, API keys, platform notes
    ├── tidal.md
    └── apple-music.md
```

---

## Core Data Types

### `TrackMetadata` (`shared/src/types/track.ts`)

```typescript
export interface TrackMetadata {
  id: string;                  // Deduplication key (source-prefixed)
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;  // Remote URL; main process fetches + caches locally
  albumArtLocalPath: string | null;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  source: 'spotify' | 'tidal' | 'apple-music' | 'unknown';
  updatedAt: number;           // Unix ms
}
```

### `ThemeManifest` (`shared/src/types/theme.ts`)

```typescript
export interface ThemeManifest {
  id: string;                  // Reverse-DNS style: com.author.theme-name
  name: string;
  version: string;
  author: string;
  description?: string;
  entrypoint: string;          // Relative path to index.html
  minAppVersion?: string;
  permissions?: ThemePermission[];  // Allowlist for optional capabilities
  defaultSize: { width: number; height: number };
  resizable?: boolean;
}

export type ThemePermission = 'network' | 'audio';
// 'network' allows fetch() inside the theme webview
// 'audio' allows Web Audio API
// All other APIs (node, ipc, filesystem) are never available in themes
```

---

## Desktop-Level Rendering

The widget window must render **below all application windows** but **above the desktop wallpaper**.

### All Platforms — Common Setup

```typescript
const widgetWindow = new BrowserWindow({
  transparent: true,
  frame: false,
  hasShadow: false,
  skipTaskbar: true,
  focusable: false,
  alwaysOnTop: false,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true,    // Required for theme sandboxing
  },
});
```

### Windows (`desktop-layer/windows.ts`)

Use the **WorkerW** trick to parent the window behind desktop icons:

```typescript
import { execSync } from 'child_process';

// After window is shown, find the WorkerW HWND via EnumWindows
// and use SetParent(widgetHWND, workerWHWND).
// This is the same technique used by Wallpaper Engine.
// Requires the native addon: packages/main/native/desktop-win32.node
// Built with node-gyp; bindings via `bindings` npm package.
```

- Implement `native/desktop-win32.cc` using Win32 `EnumWindows`, `FindWindowEx`, `SetParent`, and `SendMessage(HWND_PROGMAN, 0x052C, ...)` to spawn the WorkerW.
- Fall back to `setAlwaysOnTop(false)` + `HWND_BOTTOM` via `SetWindowPos` if WorkerW is unavailable (some Windows versions).
- Test against Windows 10 22H2 and Windows 11 24H2.

### macOS (`desktop-layer/macos.ts`)

```typescript
// Set window level below the desktop icons layer.
// kCGDesktopWindowLevel = 1001 in Quartz
// kCGDesktopIconWindowLevel = 1002
// We want kCGDesktopWindowLevel - 1 so icons render above us.
widgetWindow.setWindowButtonVisibility(false);
// Use Electron's native module or swift-bridge to call:
// [nsWindow setLevel: CGWindowLevelForKey(kCGDesktopWindowLevelKey) - 1]
// Also set collection behavior so it appears on all Spaces:
// NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary
```

- Implement via a small Swift helper invoked over a Unix socket, OR use the `@electron/native-helper` pattern.
- Handle Mission Control: the window should be **stationary** (not animate with spaces).
- Handle `NSWorkspaceActiveSpaceDidChangeNotification` to reattach if needed.

### Linux (`desktop-layer/linux.ts`)

```typescript
// After window is mapped, set _NET_WM_WINDOW_TYPE_DESKTOP via xprop or xcb.
// This works on X11-based desktops (GNOME/X, KDE/X, i3, etc.)
// Wayland: Use the wlr-layer-shell-unstable protocol via a native addon
// or electron-layer-shell (community package) if targeting wlr compositors.
```

- X11: Set `_NET_WM_WINDOW_TYPE` to `_NET_WM_WINDOW_TYPE_DESKTOP` using `xdotool` or a native `xcb` binding.
- Wayland (wlroots compositors — sway, Hyprland): Use `wlr-layer-shell` protocol, `LAYER_BACKGROUND` layer.
- GNOME Shell Wayland: The desktop window type is not honored; surface will appear as a normal window. Document this limitation. Consider a GNOME Shell extension as an optional companion.
- Detect protocol at runtime: check `WAYLAND_DISPLAY` env var and `XDG_SESSION_TYPE`.

---

## Music Source Architecture

### Interface (`sources/base.ts`)

```typescript
export interface ISource {
  readonly id: string;
  readonly displayName: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): SourceState;
  // Emits 'track-change' and 'playback-change' events
  on(event: 'track-change', listener: (track: TrackMetadata) => void): this;
  on(event: 'playback-change', listener: (track: TrackMetadata) => void): this;
  on(event: 'stopped', listener: () => void): this;
}

export interface SourceState {
  status: 'active' | 'paused' | 'stopped' | 'unavailable' | 'auth-required';
  track: TrackMetadata | null;
}
```

### Source Manager (`sources/manager.ts`)

- Maintains a **priority list** of sources (user-configurable).
- The **first active source** wins; others are polled but suppressed.
- Debounces rapid track-change events (300 ms) to avoid flicker during seek.
- Emits a single unified `now-playing-changed` IPC event to all renderer windows.

---

### Spotify (`sources/spotify.ts`)

**Strategy**: Hybrid — local WebSocket + Web API fallback.

1. **Local WebSocket** (preferred): Spotify Desktop exposes a local HTTPS WebSocket on `https://127.0.0.1:4381`. Subscribe to `player_state_changed` events. Requires extracting the OAuth token from Spotify's local storage (documented in community projects like `spotify-local-api`). This gives near-instant updates with no polling.

2. **Web API fallback**: Use the [Spotify Web API](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track) `/me/player/currently-playing` endpoint with 3-second polling. Requires user OAuth (PKCE flow). Scopes needed: `user-read-currently-playing user-read-playback-state`.

3. **OAuth flow**: Open `https://accounts.spotify.com/authorize` in a dedicated `BrowserWindow` (not the default browser), capture the redirect to `nowplaying://callback` via a registered custom protocol (`app.setAsDefaultProtocolClient`).

4. **Token refresh**: Store refresh token in `electron-store` (encrypted via `safeStorage`). Auto-refresh before expiry.

---

### TIDAL (`sources/tidal.ts`)

TIDAL has no official desktop now-playing API. Use the following strategies:

1. **TIDAL Desktop (Windows)**: Use Windows `GlobalSystemMediaTransportControlsSession` (SMTC) via a native Node addon or PowerShell subprocess. This is the same system that feeds the Windows media overlay. Works for any SMTC-enabled player.

2. **TIDAL Desktop (macOS)**: Use `MediaRemote.framework` (private Apple framework) via a Swift helper, or poll `NowPlaying.json` written by the system. Alternatively, use AppleScript if TIDAL exposes it (limited support).

3. **tidal-hifi (community Electron client)**: Exposes a local HTTP API on port `47836`. Check if running and poll `/api/v2/current-song`.

4. **Linux**: TIDAL is not natively available. Support `tidal-hifi` local API only.

**Implementation note**: Abstract each TIDAL strategy behind a `ITidalAdapter` interface; `tidal.ts` tries adapters in priority order.

---

### Apple Music (`sources/apple-music.ts`)

1. **macOS (primary)**: Use JXA (JavaScript for Automation) or AppleScript via `osascript` subprocess.
   ```applescript
   tell application "Music"
     if player state is playing then
       return {name of current track, artist of current track,
               album of current track, artwork of current track}
     end if
   end tell
   ```
   Poll every 2 seconds. For artwork, export the raw bytes from AppleScript and cache locally.

2. **Windows**: Use SMTC (`GlobalSystemMediaTransportControlsSession`) — same native addon as TIDAL Windows strategy. Apple Music for Windows (Microsoft Store) registers with SMTC.

3. **Linux**: Not supported. Apple Music is not available on Linux. Document clearly.

---

### Windows SMTC Native Addon

Create `packages/main/native/smtc/` as a C++/WinRT Node addon:

```
native/smtc/
├── binding.gyp
├── smtc.cc          # Node-API bindings
├── smtc_session.cc  # GlobalSystemMediaTransportControlsSessionManager
└── smtc_session.h
```

- Exposes `startListening(callback)` and `stopListening()` to JS.
- `callback` is called with `{ title, artist, album, artworkBuffer, isPlaying }`.
- Build with `node-gyp` in `postinstall`; ship prebuilt binaries via `prebuild` / GitHub releases.
- Only compiled/loaded on `process.platform === 'win32'`.

---

## Last.fm Scrobbling

### Auth

- Use Last.fm's [web auth flow](https://www.last.fm/api/webauth): open auth URL in a `BrowserWindow`, capture callback token, exchange for session key.
- Store session key in `electron-store` via `safeStorage`.

### Scrobble Logic (`scrobbler/lastfm.ts`)

Follow the [Last.fm scrobble rules](https://www.last.fm/api/scrobbling):

- A track must be played for **at least 30 seconds** AND **more than 50% of its duration** before scrobbling.
- Send a `track.updateNowPlaying` call immediately when a track starts.
- Send `track.scrobble` when the scrobble threshold is reached.
- Do **not** scrobble the same `(artist, title, album, timestamp)` tuple twice.

### Offline Queue (`scrobbler/queue.ts`)

- Use **better-sqlite3** to persist pending scrobbles in `userData/scrobbles.db`.
- On network restore or app start, drain the queue (batch up to 50 per request).
- Keep queue entries indefinitely until successfully submitted.

---

## Theme System

### User Theme Directory

Themes live in `{userData}/themes/{theme-id}/`. The bundled defaults ship inside the `resources/` directory and are copied to `userData` on first launch.

### Theme Manifest (`theme.json`)

```json
{
  "id": "com.yourname.minimal",
  "name": "Minimal",
  "version": "1.0.0",
  "author": "Your Name",
  "entrypoint": "index.html",
  "defaultSize": { "width": 400, "height": 120 },
  "resizable": true,
  "permissions": []
}
```

### Theme Host (`widget/src/ThemeHost.tsx`)

The widget window renders a single `<webview>` pointed at the active theme's `index.html` (loaded via `file://` path):

```tsx
<webview
  src={`file://${themePath}/index.html`}
  sandbox                          // Disables Node.js, contextBridge, etc.
  disablewebsecurity={false}       // Keep web security ON
  partition="persist:theme"        // Separate session; no access to main session cookies
  style={{ width, height }}
/>
```

**Theme receives data** via `postMessage` from the host renderer:

```typescript
// ThemeHost injects a <script> into the webview via executeJavaScript
// to set up the message contract:
webview.executeJavaScript(`
  window.__CUFFLINKS_READY = true;
`);

// Then sends updates:
webview.contentWindow.postMessage({ type: 'track-update', payload: track }, '*');
```

**Theme API contract** (document this for theme authors):

```javascript
// themes receive messages via:
window.addEventListener('message', (event) => {
  if (event.data.type === 'track-update') {
    const track = event.data.payload;
    // track: { title, artist, album, albumArtUrl, isPlaying, progressMs, durationMs }
  }
  if (event.data.type === 'settings-update') {
    // { accentColor, ... } — app-level settings passed to theme
  }
});

// themes can request actions (if permitted):
window.parent.postMessage({ type: 'cufflinks:request-size', width: 500, height: 200 }, '*');
```

**CSS variables** injected into theme context:
```css
/* Available to all themes automatically */
--np-accent: #1db954;
--np-widget-width: 400px;
--np-widget-height: 120px;
```

### Theme Security Rules

- `sandbox` attribute on `<webview>` removes all Node/Electron access.
- `webSecurity` remains **enabled** — no cross-origin relaxation.
- `allowpopups` is **not** set — themes cannot open new windows.
- `permissions` in manifest may grant `network` (enables `fetch` inside the webview's CSP) or `audio`.
- Main process validates manifest and strips unknown `permissions` values.
- Never call `webview.executeJavaScript` with user-controlled strings.

---

## IPC Channels (`shared/src/ipc-channels.ts`)

```typescript
export const IPC = {
  // Main → Renderer
  NOW_PLAYING_CHANGED: 'now-playing:changed',       // payload: TrackMetadata | null
  SOURCE_STATUS_CHANGED: 'source:status-changed',   // payload: Record<SourceId, SourceStatus>
  SCROBBLE_STATUS: 'scrobble:status',               // payload: ScrobbleStatus

  // Renderer → Main
  GET_NOW_PLAYING: 'now-playing:get',
  SET_SOURCE_PRIORITY: 'source:set-priority',
  OPEN_SPOTIFY_AUTH: 'auth:spotify:open',
  OPEN_LASTFM_AUTH: 'auth:lastfm:open',
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  GET_THEMES: 'themes:get',
  SET_ACTIVE_THEME: 'themes:set-active',
  IMPORT_THEME: 'themes:import',               // payload: fs path to zip/folder
  DELETE_THEME: 'themes:delete',
  RELOAD_THEME: 'themes:reload',               // Dev helper
} as const;
```

---

## Settings Schema (`main/src/store.ts`)

Stored via `electron-store` with a JSON schema:

```typescript
interface AppSettings {
  // Display
  activeThemeId: string;
  widgetPosition: { x: number; y: number };
  widgetSize: { width: number; height: number };
  display: number;              // Monitor index
  opacity: number;              // 0.0–1.0
  accentColor: string;          // Hex

  // Sources
  sourcePriority: SourceId[];
  spotify: {
    enabled: boolean;
    useLocalApi: boolean;
    // Tokens are NOT stored here — see CredentialStore (OS keychain / safeStorage)
  };
  tidal: {
    enabled: boolean;
  };
  appleMusic: {
    enabled: boolean;
  };

  // Scrobbling
  lastfm: {
    enabled: boolean;
    username?: string;          // Display only — session key lives in CredentialStore
    scrobbleThreshold: number;  // 0.5–1.0, default 0.5
    scrobbleMinSeconds: number; // default 30
  };

  // System
  launchOnLogin: boolean;
  showInDock: boolean;          // macOS only
  checkForUpdates: boolean;
}
```

---

## Credential Management

Cufflinks stores two distinct categories of secrets: **short-lived OAuth tokens** (Spotify access token, expiry) and **long-lived session credentials** (Spotify refresh token, Last.fm session key). These are handled differently and must never be written to `electron-store`'s plain JSON file.

### Storage Backends (`credentials/`)

Credentials are stored via a two-tier strategy, implemented behind a single `CredentialStore` interface so the rest of the codebase never touches the backend directly.

```typescript
// credentials/index.ts
export interface CredentialStore {
  get(key: CredentialKey): Promise<string | null>;
  set(key: CredentialKey, value: string): Promise<void>;
  delete(key: CredentialKey): Promise<void>;
  clear(): Promise<void>;   // Used on "Sign out of all services"
}

export type CredentialKey =
  | 'spotify.refreshToken'
  | 'spotify.accessToken'
  | 'spotify.accessTokenExpiry'
  | 'lastfm.sessionKey';
```

**Tier 1 — OS keychain** (`credentials/keychain.ts`, preferred):

Use **`keytar`** (a native Node addon that wraps Credential Manager on Windows, Keychain on macOS, and libsecret on Linux):

```typescript
import * as keytar from 'keytar';

const SERVICE = 'Cufflinks';

export const keychainBackend: CredentialStore = {
  async get(key) {
    return keytar.getPassword(SERVICE, key);
  },
  async set(key, value) {
    await keytar.setPassword(SERVICE, key, value);
  },
  async delete(key) {
    await keytar.deletePassword(SERVICE, key);
  },
  async clear() {
    const creds = await keytar.findCredentials(SERVICE);
    await Promise.all(creds.map(c => keytar.deletePassword(SERVICE, c.account)));
  },
};
```

All credential reads/writes happen **exclusively in the main process**. The renderer never calls `keytar` and never receives raw token values over IPC — it only receives derived state (e.g. `{ spotifyConnected: true, username: 'taylor' }`).

**Tier 2 — `safeStorage` fallback** (`credentials/fallback.ts`):

On Linux systems where `libsecret` is unavailable (headless servers, minimal DEs), fall back to Electron's `safeStorage` API, which uses OS-level encryption (DPAPI on Windows, Keychain on macOS, `libsecret`/`kwallet` on Linux with a derived key):

```typescript
import { safeStorage } from 'electron';
import Store from 'electron-store';

// Separate store file for encrypted blobs — never mixed with plain settings
const encStore = new Store({ name: 'credentials-enc' });

export const safeStorageBackend: CredentialStore = {
  async get(key) {
    const blob = encStore.get(key) as Buffer | undefined;
    if (!blob) return null;
    return safeStorage.decryptString(Buffer.from(blob));
  },
  async set(key, value) {
    const encrypted = safeStorage.encryptString(value);
    encStore.set(key, encrypted);
  },
  async delete(key) {
    encStore.delete(key);
  },
  async clear() {
    encStore.clear();
  },
};
```

**Backend selection** (`credentials/index.ts`):

```typescript
import { safeStorage } from 'electron';

async function resolveBackend(): Promise<CredentialStore> {
  try {
    // keytar will throw if the OS keychain is unavailable
    await keytar.findCredentials('Cufflinks-probe');
    return keychainBackend;
  } catch {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorageBackend;
    }
    // Last resort: warn the user in the UI that credentials cannot be stored securely
    throw new Error('No secure credential storage available on this system.');
  }
}

export const credentialStore: CredentialStore = await resolveBackend();
```

### IPC Contract for Auth State

The renderer must **never** request or receive raw token values. IPC exposes only auth metadata:

```typescript
// Renderer → Main
GET_AUTH_STATUS: 'auth:status'
// Response: { spotify: { connected: boolean; username?: string; expiresAt?: number };
//             lastfm:  { connected: boolean; username?: string } }

OPEN_SPOTIFY_AUTH: 'auth:spotify:open'   // Main opens OAuth BrowserWindow
OPEN_LASTFM_AUTH:  'auth:lastfm:open'    // Main opens Last.fm web auth
REVOKE_SPOTIFY:    'auth:spotify:revoke' // Main deletes tokens from keychain
REVOKE_LASTFM:     'auth:lastfm:revoke'  // Main deletes session key from keychain
```

Tokens are used inside the main process only (HTTP calls via `net.fetch()`). The renderer receives a boolean connection status and the username for display purposes, never a token string.

### Last.fm Session Key Lifecycle

The Last.fm session key is **permanent** — it does not expire and cannot be refreshed. This makes it especially important to protect:

1. **Acquisition**: User completes web auth; main process calls `auth.getSession(token)` to exchange the one-time token for a session key.
2. **Storage**: Session key is written immediately to the OS keychain via `credentialStore.set('lastfm.sessionKey', key)`. It is never held in memory beyond the auth flow.
3. **Usage**: `lastfm.ts` reads the session key from `credentialStore` on each scrobble batch. It is never cached in a module-level variable.
4. **Signing**: All Last.fm API calls that require auth use `api_sig` (HMAC-MD5 of sorted params + shared secret). The `LASTFM_SHARED_SECRET` is embedded in the main process bundle at build time and never sent to the renderer.
5. **Revocation**: On sign-out, `credentialStore.delete('lastfm.sessionKey')` is called. There is no Last.fm API endpoint to invalidate a session key server-side; document this limitation to the user.

### Spotify Token Lifecycle

```
[User clicks Connect Spotify]
        │
        ▼
Main opens BrowserWindow → accounts.spotify.com/authorize (PKCE)
        │
        ▼ redirect to cufflinks://callback?code=...
Main catches via setAsDefaultProtocolClient('cufflinks')
        │
        ▼
Main exchanges code → { access_token, refresh_token, expires_in }
        │
        ├─ credentialStore.set('spotify.accessToken', access_token)
        ├─ credentialStore.set('spotify.accessTokenExpiry', Date.now() + expires_in * 1000)
        └─ credentialStore.set('spotify.refreshToken', refresh_token)
        │
        ▼
Emit auth:status update to renderer (connected: true, username)
```

**Token refresh**: Before each API call, read `spotify.accessTokenExpiry` from the credential store. If within 5 minutes of expiry, silently refresh using the stored refresh token and overwrite both `accessToken` and `accessTokenExpiry`. The refresh token is only rotated if Spotify returns a new one (not guaranteed).

### Security Rules — Credentials

- **Never** log token values, even at `debug` level. Redact in all log output.
- **Never** include credentials in error objects that propagate to the renderer.
- **Never** store credentials in `electron-store`'s default JSON file (plaintext on disk).
- **Never** pass credentials to theme `<webview>` contexts in any form.
- The `credentials-enc` store (safeStorage fallback) must live in `userData`, not the user-facing Cufflinks home directory.
- On app uninstall, document to users that keychain entries under the service name `Cufflinks` should be removed manually if desired (electron-builder uninstallers cannot touch the OS keychain).

---

## Theme Directory

Themes live in a dedicated, user-navigable directory in the user's **home folder**, making them easy to find, edit, and share without navigating into hidden app data directories.

### Directory Layout

```
~/Cufflinks/
└── themes/
    ├── minimal/               # Bundled default — copied on first launch, read-only sentinel
    │   ├── theme.json
    │   ├── index.html
    │   ├── style.css
    │   └── script.js
    ├── glassmorphic/          # Bundled default
    │   └── ...
    └── my-custom-theme/       # User-created or user-imported
        ├── theme.json
        ├── index.html
        └── ...
```

**Platform paths** (resolved via `os.homedir()`):

| Platform | Path |
|---|---|
| Windows | `C:\Users\<user>\Cufflinks\themes\` |
| macOS | `/Users/<user>/Cufflinks/themes/` |
| Linux | `/home/<user>/Cufflinks/themes/` |

The `Cufflinks/` root intentionally uses a capital C and no dot prefix so it is immediately visible in Finder, Explorer, and file managers — users should be able to find and open it without guidance.

### Initialization (`main/src/theme-dir.ts`)

```typescript
import { app } from 'electron';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

export const CUFFLINKS_HOME = path.join(os.homedir(), 'Cufflinks');
export const THEMES_DIR = path.join(CUFFLINKS_HOME, 'themes');

export async function initThemeDirectory(): Promise<void> {
  await fs.mkdir(THEMES_DIR, { recursive: true });

  // Copy bundled defaults if not already present
  const bundledThemesDir = path.join(process.resourcesPath, 'themes');
  const bundled = await fs.readdir(bundledThemesDir);

  for (const themeName of bundled) {
    const dest = path.join(THEMES_DIR, themeName);
    try {
      await fs.access(dest);
      // Already exists — do not overwrite user edits
    } catch {
      await fs.cp(path.join(bundledThemesDir, themeName), dest, { recursive: true });
    }
  }
}
```

Call `initThemeDirectory()` early in `app.whenReady()`, before any theme reads.

### Theme Discovery (`main/src/theme-loader.ts`)

```typescript
export async function discoverThemes(): Promise<ThemeManifest[]> {
  const entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());

  const manifests = await Promise.allSettled(
    dirs.map(async (dir) => {
      const manifestPath = path.join(THEMES_DIR, dir.name, 'theme.json');
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw) as ThemeManifest;
      validateThemeManifest(parsed);   // Throws on invalid schema
      return { ...parsed, _resolvedDir: path.join(THEMES_DIR, dir.name) };
    })
  );

  // Log but do not crash on malformed themes
  const valid = manifests.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = manifests.filter(r => r.status === 'rejected');
  failed.forEach(r => console.warn('[theme-loader] Skipped malformed theme:', r.reason));

  return valid;
}
```

### Path Traversal Protection

All theme file access must be resolved against `THEMES_DIR` and checked for escapes:

```typescript
export function safeThemePath(themeId: string, relativePath: string): string {
  const base = path.join(THEMES_DIR, themeId);
  const resolved = path.resolve(base, relativePath);
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`Path traversal attempt in theme '${themeId}': ${relativePath}`);
  }
  return resolved;
}
```

Use `safeThemePath` whenever a theme manifest's `entrypoint` or any other manifest-specified file path is resolved to a filesystem path.

### File Watching (Dev & Live Reload)

Use `fs.watch` (or `chokidar` for robustness) on `THEMES_DIR` to detect:
- New subdirectory added → auto-discover and add to theme list, notify renderer.
- `theme.json` modified → re-validate and reload manifest.
- Theme files modified (when that theme is active) → emit `themes:reload` IPC event so the widget `<webview>` can reload.

```typescript
import chokidar from 'chokidar';

export function watchThemeDirectory(onChange: (event: ThemeChangeEvent) => void): () => void {
  const watcher = chokidar.watch(THEMES_DIR, { depth: 2, ignoreInitial: true });
  watcher.on('all', (event, changedPath) => {
    // Debounce 300ms, then re-run discoverThemes() and diff
  });
  return () => watcher.close();
}
```

### Import Flow

When the user imports a `.zip` file via the Theme Manager UI:

1. Validate the zip contains exactly one top-level directory.
2. Extract to a temp directory.
3. Read and validate `theme.json` from the extracted directory.
4. Sanitize `themeId` to be filesystem-safe (strip non-alphanumeric except `-._`).
5. Check for ID collision with existing themes; prompt user to overwrite or rename.
6. Move (not copy) the directory to `~/Cufflinks/themes/<themeId>/`.
7. Run `discoverThemes()` and push updated list to renderer.

Never extract zip files directly into `THEMES_DIR` — always extract to a temp location and validate before moving.

### Opening the Theme Directory

Expose a tray menu item and a Settings UI button: **"Open Themes Folder"**:

```typescript
import { shell } from 'electron';
shell.openPath(THEMES_DIR);
```

This opens the folder in the native file manager (Explorer, Finder, Nautilus), letting users drag in themes, inspect files, or edit theme code directly.

---

## Album Art Caching

- Main process fetches `albumArtUrl` via `net.fetch()` (bypasses renderer sandboxing).
- Caches to `{userData}/art-cache/` using a content-addressed filename (SHA-256 of URL). This is an internal cache directory, **not** inside `~/Cufflinks/` — users should not need to browse it.
- Serves cached art to themes as a `file://` URL via `protocol.registerFileProtocol('cufflinks-art', ...)`.
- Cache is capped at **500 MB** with LRU eviction; implement in `main/src/art-cache.ts`.
- Never pass remote URLs directly to the sandboxed theme webview unless the theme has `network` permission.

---

## Development Workflow

### Prerequisites

```bash
node >= 22 LTS
pnpm >= 9
# Windows only:
windows-build-tools (for native addons)
# macOS only:
Xcode Command Line Tools
```

### Commands

```bash
pnpm install            # Install all workspace deps
pnpm dev                # Start Electron in dev mode (Vite HMR + electron-reload)
pnpm build              # Build all packages
pnpm dist               # Build + package with electron-builder
pnpm lint               # ESLint across all packages
pnpm typecheck          # tsc --noEmit across all packages
pnpm test               # Vitest (unit) + Playwright (e2e)
```

### Environment Variables (`.env.local`, never committed)

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
LASTFM_API_KEY=
LASTFM_SHARED_SECRET=
```

These are embedded at build time via Vite `define` and compiled into the main process bundle. The Spotify client secret is used server-side only (main process), never exposed to renderer or theme contexts.

---

## Testing Strategy

| Layer | Tool | Coverage target |
|---|---|---|
| Unit (sources, scrobbler, queue) | **Vitest** | ≥ 80% |
| IPC handlers | Vitest + mock `ipcMain` | ≥ 70% |
| Theme sandboxing | Playwright (`electron-playwright-helpers`) | Key security assertions |
| E2E (auth flows, theme switching) | Playwright | Happy paths |
| Native addons | Google Test (C++) | SMTC, desktop-layer |

Mock all external HTTP calls (Spotify, Last.fm) with `msw`.

---

## Style Guide

### General Philosophy

Code in Cufflinks is read far more often than it is written. Optimize for the next contributor who has zero context — that means every public function, interface, enum, and non-obvious block of logic carries enough documentation to be understood without cross-referencing other files.

Verbosity in documentation is a feature. Verbosity in implementation is a smell.

### TSDoc — Required for All Exports

Every exported function, class, method, interface, type alias, and enum must have a TSDoc block. Use `/** */`, not `//`.

**Minimum required tags:**

| Construct | Required tags |
|---|---|
| Function / method | `@summary` (one line), `@param` for each arg, `@returns`, `@throws` if applicable |
| Async function | All of the above + note any I/O side effects in `@remarks` |
| Interface | `@summary` on the interface; `@summary` on each property that isn't self-evident |
| Type alias / enum | `@summary`; `@remarks` explaining when each variant is used |
| Class | `@summary`; `@remarks` for lifecycle notes |
| IPC handler | `@summary`, `@param event`, `@param payload` with full type inline, `@returns` |

**Example — source plugin:**

```typescript
/**
 * @summary Starts polling or listening for now-playing state from this source.
 *
 * @remarks
 * Implementations must be idempotent — calling `start()` on an already-running
 * source must not create duplicate listeners or polling intervals. Emit
 * `'track-change'` immediately if a track is already playing when started.
 *
 * @throws {SourceAuthError} If the source requires authentication and no valid
 *   credentials are found in the CredentialStore.
 * @throws {SourceUnavailableError} If the underlying player process is not
 *   running and cannot be reached.
 */
start(): Promise<void>;
```

**Example — utility function:**

```typescript
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
export function safeThemePath(themeId: string, relativePath: string): string
```

**Example — IPC handler:**

```typescript
/**
 * @summary Handles a renderer request to update the active theme.
 *
 * @remarks
 * Validates that the requested theme ID exists in the discovered theme list
 * before persisting. Rejects with a structured error if the theme is not found,
 * so the renderer can display a friendly message rather than silently failing.
 *
 * @param _event - The Electron IPC event object (unused but required by the handler signature).
 * @param themeId - Reverse-DNS theme ID, e.g. `"com.author.theme-name"`.
 * @returns A promise resolving to `{ ok: true }` on success, or
 *   `{ ok: false; reason: string }` if the theme ID is unknown.
 */
ipcMain.handle(IPC.SET_ACTIVE_THEME, async (_event, themeId: string) => { ... });
```

### Inline Comments

Use inline comments for *why*, not *what*. If the code clearly expresses what it does, skip the comment.

```typescript
// ✅ Explains non-obvious intent
// Debounce track-change events: rapid seek operations can fire many state updates
// within milliseconds. We wait 300ms of quiet before propagating to avoid
// flicker in the widget and redundant scrobble timer resets.
const debouncedEmit = debounce(emitTrackChange, 300);

// ❌ Restates the code — delete this
// Increment the counter
counter++;
```

Use `// TODO(username): description` and `// FIXME(username): description` for tracked items. Every TODO/FIXME must have a corresponding GitHub Issue number appended once one is filed: `// TODO(taylor): #42`.

### Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `art-cache.ts` |
| Classes | `PascalCase` | `CredentialStore` |
| Interfaces | `PascalCase`, no `I` prefix except `ISource` family | `ThemeManifest`, `ISource` |
| Enums | `PascalCase` members | `SourceStatus.Active` |
| Functions / methods | `camelCase`, verb-first | `discoverThemes()`, `getAuthStatus()` |
| Constants | `SCREAMING_SNAKE_CASE` for module-level primitives | `THEMES_DIR`, `MAX_CACHE_BYTES` |
| React components | `PascalCase` | `ThemeHost`, `SettingsPanel` |
| IPC channel strings | `domain:action` kebab | `'themes:set-active'` |
| Private class members | `_camelCase` | `_pollInterval` |
| Boolean variables | `is`, `has`, `can`, `should` prefix | `isPlaying`, `hasCredentials` |

### TypeScript Rules

- **No `any`** — ever. Use `unknown` and narrow, or define the type properly.
- **No non-null assertions (`!`)** without an accompanying comment explaining why the value is guaranteed to be defined.
- **Prefer `interface` over `type`** for object shapes that may be extended. Use `type` for unions, intersections, and mapped types.
- **Prefer named exports** over default exports in all packages except React component files (where default export is conventional).
- **Prefer `const` assertions** over enums for string literal sets that cross the IPC boundary, since enums don't survive serialization.
- All `async` functions must handle or explicitly propagate errors — no silent `catch (() => {})` blocks.
- Return types must be explicit on all exported functions.

### Error Handling

Define typed error classes for each major subsystem. Never throw raw strings.

```typescript
// shared/src/errors.ts

/** @summary Base class for all Cufflinks application errors. */
export class CufflinksError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CufflinksError';
  }
}

/** @summary Thrown when a music source requires authentication that is absent or expired. */
export class SourceAuthError extends CufflinksError {
  /** @param sourceId - The source that triggered the error, e.g. `'spotify'`. */
  constructor(public readonly sourceId: string) {
    super(`Source '${sourceId}' requires authentication.`, 'SOURCE_AUTH_REQUIRED');
    this.name = 'SourceAuthError';
  }
}

/** @summary Thrown when path traversal is detected during theme file resolution. */
export class ThemePathError extends CufflinksError {
  constructor(themeId: string, path: string) {
    super(`Path traversal in theme '${themeId}': ${path}`, 'THEME_PATH_TRAVERSAL');
    this.name = 'ThemePathError';
  }
}
```

Map error codes to human-readable renderer messages in `shared/src/error-messages.ts` so UI copy is never scattered across the codebase.

### File Structure Within a Module

Each `.ts` file should follow this order, separated by a blank line:

1. Imports (external packages → internal packages → relative, each group alphabetized)
2. Module-level constants
3. Types and interfaces local to this file
4. Exported functions / classes
5. Private/internal functions (suffix with `// --- internal` comment divider)

### React Component Conventions

- One component per file.
- Props interfaces are named `<ComponentName>Props` and defined immediately above the component.
- Prefer `function` declarations over arrow function assignments for top-level components (easier stack traces).
- All event handler props are prefixed `on`: `onThemeSelect`, `onAuthRevoke`.
- Side effects live in `useEffect`; never in render. Add a comment to every `useEffect` explaining what it subscribes to and why.

### CSS Modules

- Class names in `.module.css` files use `camelCase`.
- Never use element selectors (e.g. `div`, `p`) — always class selectors.
- Respect the `--np-*` CSS variable namespace for theme-facing vars; use `--cl-*` for shell-internal vars.
- Avoid magic numbers — define pixel values, durations, and z-indices as named variables at the top of each module file.

### Git Conventions

**Branch naming:**
```
feature/<shdescription>      # New functionality
fix/<short-description>          # Bug fixes
source/<service-name>            # New music source plugins
theme/<theme-name>               # New bundled themes
docs/<what-is-documented>        # Documentation only
chore/<what-is-maintained>       # Tooling, deps, config
```

**Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <imperative summary under 72 chars>

<optional body — explain the why, not the what>

<tional footer — Closes #42, Breaking Change: ...>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`.
Scopes: `spotify`, `lastfm`, `tidal`, `apple-music`, `themes`, `credentials`, `desktop-layer`, `scrobbler`, `ipc`, `build`, `deps`.

Examples:
```
feat(spotify): add local WebSocket listener as primary polling strategy

fix(credentials): prevent safeStorage fallback from writing to plain settings store
Closes #87

source(qobuz): initial ISource implementation with Web APpolling
```

---

## Release Checklist

- [ ] Code sign on macOS (Developer ID Application cert) — required for Gatekeeper
- [ ] Notarize macOS build via `electron-notarize`
- [ ] Code sign on Windows (EV cert or standard cert) — unsigned shows SmartScreen warning
- [ ] AppImage + `.deb` for Linux; do **not** require root for install
- [ ] Confirm `app.setAsDefaultProtocolClient('cufflinks')` works for OAuth callback on all platforms
- [ ] Auto-updater smoke test before each release
- [ ] Ship prebuilt ve addon binaries (SMTC, keytar) for all supported Node ABI versions

---

## Known Platform Limitations

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Desktop-level rendering | ✅ WorkerW | ✅ Window level | ⚠️ X11 only; Wayland compositor-dependent |
| Apple Music | ✅ SMTC | ✅ AppleScript | ❌ Not available |
| TIDAL | ✅ SMTC | ⚠️ MediaRemote (private API) | ⚠️ tidal-hifi only |
| Spotify local API | ✅ | ✅ | ✅ |
| SMTC (catch-all player) | ✅ | ❌ | ❌ |

---

## ributing

All contributions — new sources, bug fixes, themes, documentation — are welcome. This section covers the full contributor workflow and goes into depth on adding a new music source, which is the most common and most impactful contribution a new contributor can make.

### First-Time Setup

```bash
git clone https://github.com/<org>/cufflinks.git
cd cufflinks
pnpm install          # Installs all workspace dependencies
pnpm dev              # Starts Electron in development mode
```

On **Windows**so run `npx windows-build-tools` (as Administrator) before `pnpm install` to set up the native addon toolchain.
On **macOS**, ensure Xcode Command Line Tools are installed: `xcode-select --install`.

Copy `.env.example` to `.env.local` and fill in your Spotify and Last.fm API keys for development.

### Where Things Live

Before touching code, orient yourself with this map:

| What you want to change | Where to look |
|---|---|
| Add a new music source | `packages/main/src/sources/` |
| Modify scrobble logic | `packages/main/src/scrobbler/` |
| Add a new IPC channel | `shared/src/ipc-channels.ts` + `packages/main/src/ipc/handlers.ts` |
| Change credential handling | `packages/main/src/credentials/` |
| Add a bundled theme | `themes/` at repo root |
| Modify the settings UI | `packages/renderer/src/views/Settings/` |
| Modify the widget window | `packages/widget/src/` |
| Change desktop-layer behavior | `packages/main/src/desktop-layer/` |
| Add shared types | `packages/shared/src/types/` |
| Update documentation | `docs/` |

### Adding a New Music Source

This is designed to require changes in **exactly four places**, nothing more:

**1. Implement `ISource` in `packages/main/src/sources/<service-name>.ts`**

Copy `sources/_template.ts` as your starting point. The template contains TSDoc stubs for every method you must implement:

```typescript
import { EventEmitter } from 'events';
import type { ISource, SourceState } from './base.js';
import type { TrackMetadata } from '@cufflinks/shared';

/**
 * @summary Music source plugin for <Service Name>.
 *
 * @remarks
 * Describe the strategy used to get now-playing state here — e.g. "Polls the
 * <Service> Web API every 3 seconds using the user's OAuth access token." Include
 * any platform limitations, known quirks, or links to relevant API docs.
 *
 * Platform support:
 * - Windows: <strategy>
 * - macOS: <strategy>
 * - Linux: <strategy or 'Not supported'>
 *
 * @see {@link https://developer.example.com/api/now-playing} <Service> API docs
 */
export class ServiceNaSource extends EventEmitter implements ISource {
  readonly id = 'service-name';
  readonly displayName = 'Service Name';

  /**
   * @summary Current source state, including playback status and active track.
   * Updated on every poll cycle or event.
   */
  private _state: SourceState = { status: 'unavailable', track: null };

  /**
   * @summary Interval handle for the polling loop, if polling is used.
   * Null when the source is stopped.
   */
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  // --- ISource implementation

  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  getState(): SourceState { return this._state; }
}
```

Emit events in the standardized way — other parts of the codebase depend on the exact event names and payload shape:

```typescript
// When the track changes (different song)
this.emit('track-change', updatedTrack satisfies TrackMetadata);

// When playback state changes but track identity hasn't (pause/resume, seek)his.emit('playback-change', updatedTrack satisfies TrackMetadata);

// When the player stops or becomes unreachable
this.emit('stopped');
```

**2. Export from `packages/main/src/sources/index.ts`**

```typescript
export { ServiceNameSource } from './service-name.js';
```

**3. Register in `packages/main/src/sources/manager.ts`**

Add the new source to the `ALL_SOURCES` array. The manager handles priority, deduplication, and IPC fanout automatically:

```typescript
import { ServiceNameSource } from './service-name.js';

const ALL_SOURCES: ISource[] = [
  new SpotifySource(),
  new TidalSource(),
  new AppleMusicSource(),
  new ServiceNameSource(),   // ← add here
];
```

**4. Add to the Settings UI source list in `packages/renderer/src/views/Settings/SourcesPanel.tsx`**

```typescript
const SOURCE_METADATA: Record<string, { label: string; icon: string }> = {
  spotify:       { label: 'Spotify',       icon: 'spotify.svg'  },
  tidal:         { label: 'TIDAL',         icon: 'tidal.svg'    },
  'apple-music': label: 'Apple Music',   icon: 'apple.svg'    },
  'service-name': { label: 'Service Name', icon: 'service.svg'  }, // ← add here
};
```

Place the service icon (SVG, 24×24 viewBox) in `packages/renderer/src/assets/icons/sources/`.

That's the entire surface area. The new source will automatically appear in the priority list, status indicators, and platform limitations table (update that table in CLAUDE.md too).

### Source Implementation Patterns

**Polling (most common for Web API sources):**

```typesct
/**
 * @summary Starts the polling loop that fetches now-playing state on a fixed interval.
 *
 * @remarks
 * Idempotent — safe to call if already running. Clears any existing interval
 * before starting a new one to prevent duplicate polls after credential refresh.
 * Poll interval is 3 seconds, which balances responsiveness against API rate limits.
 */
private _startPolling(): void {
  this._stopPolling();
  this._pollInterval = setInterval(() => this._poll(), 3_000);
  // Poll immediately rather thanaiting for the first interval to elapse
  void this._poll();
}

/** @summary Fetches current playback state and emits change events if needed. */
private async _poll(): Promise<void> {
  try {
    const data = await this._fetchNowPlaying();
    this._reconcile(data);
  } catch (err) {
    if (err instanceof SourceAuthError) {
      this._setState({ status: 'auth-required', track: null });
      this._stopPolling();
    } else {
      // Transient network error — log and continue polling
      console.warn[${this.id}] Poll failed:`, err);
    }
  }
}
```

**Event-driven (WebSocket / OS event listener):**

Prefer this over polling when the service provides a real-time push mechanism. See `sources/spotify.ts` for the local WebSocket implementation as a reference.

**Native addon (SMTC, AppleScript, MediaRemote):**

Platform-specific sources that require native code should guard with a runtime platform check:

```typescript
if (process.platform !== 'win32') {
  throw new SourceUnavailableError(this.id, 'SMTC is only available on Windows.');
}
const smtc = require('../native/smtc/smtc.node');
```

Document the native build requirements in your source file's TSDoc `@remarks`.

### Writing Tests for a New Source

Every source must include a Vitest test file at `packages/main/src/sources/<service-name>.test.ts`. At minimum, cover:

- `start()` → emits `'track-change'` with correct `TrackMetadata` shape when a track is playing
- `start()` is idempotent (safe to call twice)
- `stop()` clears the polling interval / cles the connection
- Auth failure transitions state to `auth-required` and stops polling
- Transient network errors do not crash the source
- `getState()` returns current state accurately

Mock all HTTP calls using `msw`. Do not make real API calls in tests.

### Pull Request Process

1. Branch from `main` using the naming convention in the Style Guide.
2. Keep PRs focused — one source per PR, one bug fix per PR. Avoid mixing concerns.
3. Update `docs/sources/<service-name>.md` with setup instructions, APIey requirements, and platform notes for the service.
4. Update the **Known Platform Limitations** table in CLAUDE.md.
5. Add your source to the **Roadmap** section below, moving it from "Planned" to "In Progress" or "Shipped".
6. All CI checks must pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
7. Request review from at least one maintainer before merging.

### Contributing — Theme Development

See `docs/theme-authoring.md` for full documentation. Short version:

1. Create a folder in `~/Cufflinks/them/your-theme-id/`
2. Add `theme.json` with a valid `ThemeManifest`
3. Write `index.html` — listen for `message` events for track data
4. Open **Cufflinks → Settings → Themes** to pick up the new theme automatically (file watcher handles discovery)
5. Use the **"Open Themes Folder"** tray/settings shortcut to navigate there quickly
6. Package as a `.zip` for distribution; users can drag-import via the Theme Manager UI

To contribute a bundled theme, copy the folder to `themes/` at the repo root and open Bundled themes must work on all platforms, have no external `network` permission dependency, and include a screenshot in `themes/<theme-id>/preview.png`.

---

## Roadmap

The roadmap is organized by phase. Shipped items are checked. In-progress items are marked. Planned items are unchecked. Community contributions to any planned item are encouraged — check for an existing issue before starting, or open one to signal intent.

### Phase 1 — Foundation ✅ (v0.1)

- [x] Cross-platform Electron shell withparent widget window
- [x] Desktop-level rendering (Windows WorkerW, macOS window level, Linux X11)
- [x] Theme system with `<webview>` sandboxing and `postMessage` API
- [x] `~/Cufflinks/themes/` home directory with file watcher and live reload
- [x] Bundled themes: Minimal, Glassmorphic
- [x] Spotify source (Web API polling + local WebSocket)
- [x] TIDAL source (SMTC on Windows, tidal-hifi on Linux)
- [x] Apple Music source (AppleScript on macOS, SMTC on Windows)
- [x] Last.fm scrobbling with offline queue
- [x] OS keychain credential storage (keytar + safeStorage fallback)
- [x] System tray with source status indicators

### Phase 2 — Expanded Source Support (v0.2–v0.3)

- [ ] **YouTube Music** — Poll via the YouTube Music Web API or [ytmdesktop](https://github.com/ytmdesktop/ytmdesktop) local companion API. Desktop app exposes a REST API on `localhost:9863` when companion mode is enabled. All platforms.
- [ ] **Amazon Music** — SMTC on Windows (Amazon Music app registers with SMTC). macOS: poll vicript if the app exposes it; otherwise not supported.
- [ ] **Plex** — Poll the Plex Media Server `/status/sessions` endpoint using the user's Plex token. Requires the user to input their Plex server URL. Works wherever a Plex server is reachable, all platforms.
- [ ] **Qobuz** — Poll Qobuz Web API `/catalog/search` + `/user/library/albums` for current playback. Requires OAuth. All platforms where the Qobuz desktop app runs (Windows, macOS).
- [ ] **Deezer** — Poll Deezer API `/user/me/history` or int with [SMTC on Windows](https://learn.microsoft.com/en-us/uwp/api/windows.media.control). Deezer desktop app supports SMTC. macOS: AppleScript exploration needed.
- [ ] **Pandora** — Web-only player; poll via browser extension companion or `puppeteer`-based DOM observer running against the Pandora web app. Investigate feasibility before implementing.
- [ ] **SoundCloud** — Web player only; companion extension approach similar to Pandora. Investigate feasibility.
- [ ] **Jellyfin** — Poll Jellyfin servessions` endpoint. Self-hosted. Requires user to input server URL and API key. High priority for the self-hosting community.
- [ ] **Navidrome / Subsonic** — Implement Subsonic API `/rest/getNowPlaying.view`. Covers Navidrome, Airsonic, Funkwhale (Subsonic-compatible), and others. All platforms.
- [ ] **Last.fm "Scrobbling to" reverse** — Display what other Last.fm users are scrobbling (friend activity feed) as an optional source/overlay.

### Phase 3 — Widget & Theme Improvements (v0.3–v0.4)

- [ ]arketplace — in-app browse/install from a curated community registry (hosted as a static JSON manifest on GitHub Pages)
- [ ] Multi-monitor support — pin widget to a specific display; follow cursor to active display
- [ ] Lyrics overlay — fetch synchronized lyrics from Musixmatch or lrclib.net and expose to themes via `postMessage`
- [ ] Animated album art — detect and render GIFs/videos when the source provides them
- [ ] Widget click-through mode toggle (focusable vs. fully transparent to mouse)
--source theme overrides — use a different theme when a specific source is active
- [ ] Theme hot-reload improvements — preserve scroll position and animation state across reloads

### Phase 4 — Scrobbler & Social (v0.4–v0.5)

- [ ] **ListenBrainz** scrobbling — open-source Last.fm alternative; uses simpler token auth
- [ ] **Libre.fm** scrobbling — Last.fm-protocol compatible; trivial to add once Last.fm is solid
- [ ] Scrobble history viewer — in-app table of recent scrobbles with status (pened / failed)
- [ ] Manual scrobble correction — edit or delete a queued scrobble before submission
- [ ] Love/unlove track — send `track.love` to Last.fm directly from the widget via a theme action message

### Phase 5 — Platform & Distribution (v0.5–v1.0)

- [ ] macOS Wayland/Spaces edge-case hardening
- [ ] GNOME Shell Wayland companion extension (separate repo, optional install)
- [ ] Windows 11 widget panel integration (explore Microsoft Adaptive Cards or web widget API)
- [ ] Homebrew cask formmacOS
- [ ] AUR package for Arch Linux
- [ ] Winget manifest for Windows
- [ ] Flatpak for Linux (sandboxing implications for keytar/libsecret need investigation)
- [ ] Auto-update for AppImage (currently unsupported by electron-updater without additional tooling)

### Backlog / Under Consideration

- Native menu bar / taskbar mode (macOS menu bar, Windows system tray expand)
- MPRIS D-Bus source for Linux (catch-all for any MPRIS2-compliant player — VLC, Rhythmbox, Clementine, etc.) — **high value, relely straightforward**
- Discord Rich Presence integration (show now-playing in Discord status)
- Global media key support (override system media keys to control the active source)
- Accessibility audit (WCAG 2.1 AA for the settings UI)
- Localization / i18n framework

---

## References

- [Spotify Web API — Currently Playing](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track)
- [Last.fm Scrobble API](https://www.last.fm/api/show/track.scrobble)
- [Last.fmeb Auth](https://www.last.fm/api/webauth)
- [ListenBrainz API](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html)
- [keytar — Node.js native keychain](https://github.com/atom/node-keytar)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Windows SMTC docs](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager- [wlr-layer-shell protocol](https://wayland.app/protocols/wlr-layer-shell-unstable-v1)
- [Wallpaper Engine WorkerW technique](https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction#workerw)
- [MPRIS2 D-Bus interface spec](https://specifications.freedesktop.org/mpris-spec/latest/)
- [ytmdesktop companion API](https://github.com/ytmdesktop/ytmdesktop/wiki/Companion-API)
- [Subsonic API reference](http://www.subsonic.org/pages/api.jsp)
- [TSDoc reference](https://tsdoc.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
