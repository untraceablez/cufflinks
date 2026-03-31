# Theme Authoring Guide

Themes are HTML/CSS/JS packages placed in `~/Cufflinks/themes/<theme-id>/`.

## Getting Started

1. Create a folder: `~/Cufflinks/themes/com.yourname.mytheme/`
2. Add `theme.json` (see schema below)
3. Write `index.html` and listen for track data via `window.addEventListener('message', ...)`
4. Open **Cufflinks → Settings → Themes** to activate your theme (the file watcher picks it up automatically)

## theme.json Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Reverse-DNS ID, e.g. `com.yourname.theme-name` |
| `name` | string | ✅ | Display name |
| `version` | string | ✅ | Semver string |
| `author` | string | ✅ | Your name |
| `entrypoint` | string | ✅ | Relative path to your HTML file |
| `defaultSize` | `{width, height}` | ✅ | Initial widget dimensions in pixels |
| `description` | string | — | Short description shown in the theme picker |
| `resizable` | boolean | — | Whether the user can resize the widget |
| `permissions` | string[] | — | `["network"]` or `["audio"]` if needed |

## Receiving Track Data

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'track-update') {
    const track = event.data.payload;
    // track is null when nothing is playing, or:
    // {
    //   title: string,
    //   artist: string,
    //   album: string,
    //   albumArtUrl: string | null,
    //   isPlaying: boolean,
    //   progressMs: number,
    //   durationMs: number,
    //   source: 'spotify' | 'tidal' | 'apple-music' | 'unknown'
    // }
  }
});
```

## CSS Variables

These are automatically injected into your theme's root element:

| Variable | Description |
|---|---|
| `--np-accent` | App accent color (user-configurable, default `#1db954`) |
| `--np-widget-width` | Current widget width in px |
| `--np-widget-height` | Current widget height in px |

## Permissions

By default, themes run in a strict sandbox with no network access. If your theme needs to fetch external resources, add `"network"` to `permissions` in `theme.json`. If it uses the Web Audio API, add `"audio"`.

```json
{
  "permissions": ["network"]
}
```

Node.js, IPC, and filesystem access are **never** available to themes, regardless of permissions.

## Distributing Themes

Package your theme folder as a `.zip` file. Users can drag-import it via **Cufflinks → Settings → Themes → Import**.

The zip must contain exactly one top-level directory named after your theme ID.

## Tips

- Use `background: transparent` on `body` — the widget window is see-through.
- Prefer `backdrop-filter: blur(...)` for the frosted glass look.
- Test with long track titles to ensure text truncation works correctly.
- Add a `preview.png` screenshot to your theme folder for the theme picker.
