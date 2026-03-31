/**
 * @summary Adapter for the tidal-hifi community Electron client local HTTP API.
 *
 * @remarks
 * tidal-hifi (https://github.com/Mastermindzh/tidal-hifi) exposes a REST API
 * on `http://localhost:47836` when its companion integration is enabled.
 *
 * API endpoint: GET /api/v2/current-song
 *
 * Supported on all platforms where tidal-hifi runs (Windows, macOS, Linux).
 * On Linux, this is the only TIDAL integration available since the official
 * TIDAL app does not exist for Linux.
 */

/** @summary Port that tidal-hifi listens on for its companion API. */
const TIDAL_HIFI_PORT = 47836;

/** @summary Full base URL for the tidal-hifi local API. */
const TIDAL_HIFI_BASE = `http://localhost:${TIDAL_HIFI_PORT}`;

/**
 * @summary Current-song response shape from tidal-hifi's `/api/v2/current-song`.
 *
 * @remarks
 * The `duration` field format has varied across tidal-hifi releases:
 * - v4.x and earlier: `"3:45"` (mm:ss string)
 * - v5.x+: `234` (total seconds as a number)
 * Both are handled by `parseDurationMs`.
 */
interface TidalHifiCurrentSong {
  title: string;
  artists: string;
  album: string;
  /** URL to album art, served from TIDAL's CDN. */
  cover?: string;
  /** Track duration — either a number (seconds) or "mm:ss" string depending on version. */
  duration: number | string;
  /** Playback status string from tidal-hifi. */
  status: string;
  /** URL-encoded path fragment for the current track on TIDAL. */
  url?: string;
}

/**
 * @summary Normalized now-playing data from the tidal-hifi adapter.
 */
export interface TidalHifiNowPlaying {
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  durationMs: number;
  isPlaying: boolean;
}

/**
 * @summary Queries the tidal-hifi local API for the currently playing track.
 *
 * @remarks
 * Returns `null` in any of these cases:
 * - tidal-hifi is not running (connection refused)
 * - Nothing is playing (`status === 'stopped'` or empty title)
 * - The response cannot be parsed
 *
 * Uses a 2-second timeout so a stalled tidal-hifi process doesn't block polling.
 *
 * @returns Normalized now-playing data, or `null`.
 */
export async function queryTidalHifi(): Promise<TidalHifiNowPlaying | null> {
  let response: Response;
  try {
    response = await fetch(`${TIDAL_HIFI_BASE}/api/v2/current-song`, {
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // tidal-hifi not running or not reachable
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  if (!isTidalHifiResponse(body)) return null;

  const status = body.status.toLowerCase();
  if (status === 'stopped' || !body.title) return null;

  return {
    title: body.title,
    artist: body.artists,
    album: body.album,
    albumArtUrl: body.cover ?? null,
    durationMs: parseDurationMs(body.duration),
    isPlaying: status === 'playing',
  };
}

/**
 * @summary Checks whether tidal-hifi's API is reachable at all.
 *
 * @remarks
 * Used during adapter probing to quickly rule out tidal-hifi before trying
 * more expensive SMTC queries. Returns `true` even if nothing is currently
 * playing — just that the HTTP server is up.
 *
 * @returns `true` if tidal-hifi responded to a HEAD request within 1 second.
 */
export async function isTidalHifiRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${TIDAL_HIFI_BASE}/api/v2/current-song`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok || response.status === 405; // 405 = HEAD not allowed but server is up
  } catch {
    return false;
  }
}

// --- internal ---

/**
 * @summary Narrows an unknown API response to `TidalHifiCurrentSong`.
 *
 * @param v - The parsed JSON value.
 * @returns `true` if `v` has the required shape.
 */
function isTidalHifiResponse(v: unknown): v is TidalHifiCurrentSong {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['title'] === 'string' &&
    typeof o['artists'] === 'string' &&
    typeof o['album'] === 'string' &&
    typeof o['status'] === 'string'
  );
}

/**
 * @summary Converts a tidal-hifi duration value to milliseconds.
 *
 * @remarks
 * Handles both number (seconds) and "mm:ss" string formats emitted by different
 * tidal-hifi versions. Returns 0 for unrecognized formats rather than throwing.
 *
 * @param duration - Raw duration from the API response.
 * @returns Duration in milliseconds.
 */
function parseDurationMs(duration: number | string): number {
  if (typeof duration === 'number') {
    return Math.round(duration * 1_000);
  }
  // "mm:ss" or "h:mm:ss" string
  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    const [minutes, seconds] = parts as [number, number];
    return (minutes * 60 + seconds) * 1_000;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts as [number, number, number];
    return (hours * 3_600 + minutes * 60 + seconds) * 1_000;
  }
  return 0;
}
