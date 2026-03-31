import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { SourceState, TrackMetadata } from '@cufflinks/shared';
import { findSMTCSession } from './adapters/smtc.js';
import { queryTidalHifi } from './adapters/tidal-hifi.js';

/**
 * @summary Music source plugin for TIDAL.
 *
 * @remarks
 * TIDAL has no official desktop now-playing API. This source tries three
 * adapters in priority order, selecting the first that yields data:
 *
 * 1. **Windows SMTC** (Windows only, official TIDAL app):
 *    Queries `GlobalSystemMediaTransportControlsSessionManager` via a PowerShell
 *    subprocess. Finds the session whose `SourceAppUserModelId` contains "tidal".
 *    Works with the Microsoft Store version and the Win32 installer.
 *    Requires Windows 10 1903+ (build 18362). No native addon needed.
 *
 * 2. **tidal-hifi local API** (all platforms):
 *    Polls `http://localhost:47836/api/v2/current-song` — the REST API exposed
 *    by the tidal-hifi community Electron client when companion mode is on.
 *    This is the only option on Linux.
 *
 * 3. **Unavailable**: Neither adapter succeeded — source status set to
 *    `'unavailable'` and polling continues in case the player starts later.
 *
 * Platform support:
 * - Windows: SMTC primary → tidal-hifi fallback
 * - macOS: tidal-hifi only (MediaRemote integration planned, see TODO)
 * - Linux: tidal-hifi only
 *
 * @see {@link https://github.com/Mastermindzh/tidal-hifi} tidal-hifi project
 * @see {@link https://learn.microsoft.com/en-us/uwp/api/windows.media.control} SMTC API docs
 */
export class TidalSource extends EventEmitter implements ISource {
  readonly id = 'tidal';
  readonly displayName = 'TIDAL';

  private _state: SourceState = { status: 'unavailable', track: null };

  /**
   * @summary Handle for the main polling interval.
   * Null when the source is stopped.
   */
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * @summary The active adapter name, logged on first successful data fetch.
   * Helps with diagnostics when the user has both the official app and tidal-hifi.
   */
  private _activeAdapter: 'smtc' | 'tidal-hifi' | null = null;

  // --- ISource implementation ---

  /** @summary Starts the polling loop. Idempotent — safe to call if already running. */
  async start(): Promise<void> {
    if (this._pollInterval !== null) return;
    this._startPolling();
  }

  /** @summary Stops the polling loop and resets state to `'stopped'`. */
  async stop(): Promise<void> {
    this._stopPolling();
    this._activeAdapter = null;
    this._setState({ status: 'stopped', track: null });
  }

  /** @summary Returns the current source state snapshot. */
  getState(): SourceState {
    return this._state;
  }

  // --- internal ---

  /**
   * @summary Starts the polling loop, polling immediately then on a 5-second interval.
   *
   * @remarks
   * 5 seconds rather than the default 3 because the SMTC adapter spawns a
   * PowerShell subprocess on each call (~200–300 ms startup overhead). This
   * keeps CPU overhead acceptable while still catching track changes promptly.
   */
  private _startPolling(): void {
    this._stopPolling();
    this._pollInterval = setInterval(() => { void this._poll(); }, 5_000);
    void this._poll();
  }

  /** @summary Clears the polling interval. */
  private _stopPolling(): void {
    if (this._pollInterval !== null) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  /**
   * @summary Runs one poll cycle: fetches now-playing data and reconciles state.
   *
   * @remarks
   * Errors from individual adapters are silenced here — a failing adapter simply
   * returns null and the next adapter is tried. Only unexpected thrown errors
   * (bugs in this file) are logged.
   */
  private async _poll(): Promise<void> {
    try {
      const track = await this._fetchNowPlaying();
      this._reconcile(track);
    } catch (err) {
      console.warn(`[${this.id}] Poll failed:`, err);
    }
  }

  /**
   * @summary Tries each adapter in priority order and returns the first result.
   *
   * @remarks
   * Adapter priority:
   * 1. SMTC (Windows only) — official TIDAL app
   * 2. tidal-hifi HTTP API — community client, all platforms
   *
   * Returns `null` if no adapter has data (nothing playing or no supported app running).
   *
   * @returns Normalized `TrackMetadata`, or `null` if nothing is playing.
   */
  private async _fetchNowPlaying(): Promise<TrackMetadata | null> {
    // --- Adapter 1: Windows SMTC ---
    if (process.platform === 'win32') {
      const smtcSession = await findSMTCSession('tidal');
      if (smtcSession !== null) {
        if (this._activeAdapter !== 'smtc') {
          this._activeAdapter = 'smtc';
          console.info(`[${this.id}] Using SMTC adapter (appId: ${smtcSession.appId})`);
        }
        return this._smtcSessionToTrack(smtcSession);
      }
    }

    // --- Adapter 2: tidal-hifi local HTTP API ---
    const hifiData = await queryTidalHifi();
    if (hifiData !== null) {
      if (this._activeAdapter !== 'tidal-hifi') {
        this._activeAdapter = 'tidal-hifi';
        console.info(`[${this.id}] Using tidal-hifi adapter`);
      }
      return {
        id: `tidal:${hifiData.title}:${hifiData.artist}`,
        title: hifiData.title,
        artist: hifiData.artist,
        album: hifiData.album,
        albumArtUrl: hifiData.albumArtUrl,
        albumArtLocalPath: null,
        durationMs: hifiData.durationMs,
        // tidal-hifi does not expose current position in v2 API
        progressMs: 0,
        isPlaying: hifiData.isPlaying,
        source: 'tidal',
        updatedAt: Date.now(),
      };
    }

    // Neither adapter has data — nothing playing or no supported client running
    return null;
  }

  /**
   * @summary Converts an `SmtcSession` to a `TrackMetadata` record.
   *
   * @remarks
   * The SMTC session does not provide a stable track ID, so we derive one from
   * `title + artist`. This is the same key used by the tidal-hifi adapter, which
   * prevents false `track-change` events if the source switches mid-song.
   *
   * @param session - The SMTC session to convert.
   * @returns A fully populated `TrackMetadata` object.
   */
  private _smtcSessionToTrack(session: Awaited<ReturnType<typeof findSMTCSession>> & object): TrackMetadata {
    return {
      id: `tidal:${session.title}:${session.artist}`,
      title: session.title,
      artist: session.artist,
      album: session.album,
      // SMTC does not provide artwork URLs — album art caching is not available
      // via this adapter. A future SMTC native addon could read thumbnail streams.
      albumArtUrl: null,
      albumArtLocalPath: null,
      durationMs: session.durationMs,
      progressMs: session.positionMs,
      isPlaying: session.isPlaying,
      source: 'tidal',
      updatedAt: Date.now(),
    };
  }

  /**
   * @summary Compares new track data against current state and emits the
   * appropriate event if anything changed.
   *
   * @param track - Latest `TrackMetadata`, or `null` if nothing is playing.
   */
  private _reconcile(track: TrackMetadata | null): void {
    if (track === null) {
      if (this._state.status !== 'stopped' && this._state.status !== 'unavailable') {
        this._setState({ status: 'stopped', track: null });
        this.emit('stopped');
      } else if (this._state.status === 'unavailable') {
        // Stay unavailable — don't re-emit stopped if we never had a track
      }
      return;
    }

    const prev = this._state.track;
    this._setState({ status: track.isPlaying ? 'active' : 'paused', track });

    if (prev?.id !== track.id) {
      this.emit('track-change', track);
    } else if (prev?.isPlaying !== track.isPlaying) {
      this.emit('playback-change', track);
    }
  }

  /**
   * @summary Updates internal state atomically.
   * Always use this instead of directly mutating `_state`.
   *
   * @param state - The new state to apply.
   */
  private _setState(state: SourceState): void {
    this._state = state;
  }
}
