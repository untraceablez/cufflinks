import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * @summary Raw session data returned by the PowerShell SMTC query script.
 *
 * @remarks
 * Fields map directly from the PowerShell `[PSCustomObject]` output.
 * `durationMs` and `positionMs` may be 0 if the source app does not report
 * timeline information to SMTC.
 */
export interface SmtcSession {
  /** @summary Track title as reported by the source application. */
  title: string;
  /** @summary Primary artist string as reported by the source application. */
  artist: string;
  /** @summary Album title as reported by the source application. */
  album: string;
  /** @summary Whether the source application is currently playing (not paused). */
  isPlaying: boolean;
  /** @summary Track duration in milliseconds. 0 if not reported. */
  durationMs: number;
  /** @summary Current playback position in milliseconds. 0 if not reported. */
  positionMs: number;
  /**
   * @summary The Application User Model ID of the media source.
   *
   * @remarks
   * Used to identify which application owns the session, e.g.:
   * - TIDAL desktop: `"TIDAL.TIDAL"` (Microsoft Store) or path-based for Win32
   * - Spotify: `"Spotify.exe"`
   * - Windows Media Player: `"Microsoft.ZuneMusic_..."`
   */
  appId: string;
}

/**
 * @summary PowerShell script that queries all active SMTC sessions.
 *
 * @remarks
 * Loads the Windows.Media.Control WinRT namespace via PowerShell's ContentType
 * attribute trick (works on Windows 10 1903+ / Windows 11). Returns a JSON array
 * of all active sessions — even if the session is not the focused/current one.
 *
 * Uses `.GetAwaiter().GetResult()` to synchronously wait for WinRT async operations,
 * which is safe here because we're running in a fire-and-forget PowerShell subprocess.
 *
 * `-NoProfile -NonInteractive` keeps startup time to ~200–300 ms.
 */
const SMTC_QUERY_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus,Windows.Media.Control,ContentType=WindowsRuntime]
  $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().AsTask().GetAwaiter().GetResult()
  $sessions = $mgr.GetSessions()
  $result = @()
  foreach ($s in $sessions) {
    try {
      $props    = $s.TryGetMediaPropertiesAsync().AsTask().GetAwaiter().GetResult()
      $playback = $s.GetPlaybackInfo()
      $timeline = $s.GetTimelineProperties()
      $isPlaying = $playback.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
      $result += [PSCustomObject]@{
        title      = [string]$props.Title
        artist     = [string]$props.Artist
        album      = [string]$props.AlbumTitle
        isPlaying  = [bool]$isPlaying
        durationMs = [long]$timeline.EndTime.TotalMilliseconds
        positionMs = [long]$timeline.Position.TotalMilliseconds
        appId      = [string]$s.SourceAppUserModelId
      }
    } catch {}
  }
  $result | ConvertTo-Json -Compress -AsArray
} catch {
  Write-Output '[]'
}
`.trim();

/**
 * @summary Queries all active Windows SMTC sessions via a PowerShell subprocess.
 *
 * @remarks
 * Spawns `powershell.exe` with `-NoProfile -NonInteractive` to minimize startup
 * overhead (~200–300 ms per call). Results are cached for one poll cycle to avoid
 * double-spawning when multiple sources query SMTC simultaneously.
 *
 * Only callable on `process.platform === 'win32'`. Returns an empty array on any
 * error (e.g. PowerShell unavailable, no SMTC sessions, WinRT load failure).
 *
 * @returns Array of active SMTC sessions, or `[]` if none / on error.
 */
export async function querySMTCSessions(): Promise<SmtcSession[]> {
  if (process.platform !== 'win32') return [];

  try {
    const { stdout } = await execAsync(
      `powershell.exe -NoProfile -NonInteractive -Command "${SMTC_QUERY_SCRIPT.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { timeout: 5_000 },
    );
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '[]') return [];

    const parsed: unknown = JSON.parse(trimmed);

    // PowerShell serializes a single object (not an array) when there is exactly
    // one session — normalize to an array in that case.
    const sessions = Array.isArray(parsed) ? parsed : [parsed];

    return sessions.filter(isSmtcSessionShape);
  } catch {
    // Any error (timeout, parse failure, PowerShell unavailable) → no sessions
    return [];
  }
}

/**
 * @summary Finds the first SMTC session whose `appId` matches a given filter.
 *
 * @param appIdFilter - Case-insensitive substring to match against `appId`.
 * @returns The matching session, or `null` if not found.
 */
export async function findSMTCSession(appIdFilter: string): Promise<SmtcSession | null> {
  const sessions = await querySMTCSessions();
  const lower = appIdFilter.toLowerCase();
  return sessions.find((s) => s.appId.toLowerCase().includes(lower)) ?? null;
}

// --- internal ---

/**
 * @summary Validates that an unknown value has the shape of `SmtcSession`.
 *
 * @param v - The value to check.
 * @returns `true` if `v` is a valid `SmtcSession`.
 */
function isSmtcSessionShape(v: unknown): v is SmtcSession {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['title'] === 'string' &&
    typeof o['artist'] === 'string' &&
    typeof o['album'] === 'string' &&
    typeof o['isPlaying'] === 'boolean' &&
    typeof o['durationMs'] === 'number' &&
    typeof o['positionMs'] === 'number' &&
    typeof o['appId'] === 'string'
  );
}
