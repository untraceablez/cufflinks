import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { SourceState, TrackMetadata } from '@cufflinks/shared';
import { SourceAuthError, SourceUnavailableError } from '@cufflinks/shared';

/**
 * @summary Music source plugin for Spotify.
 *
 * @remarks
 * Uses a hybrid strategy for now-playing state:
 *
 * 1. **Local WebSocket (preferred)**: Spotify Desktop exposes a local HTTPS WebSocket
 *    on `https://127.0.0.1:4381`. Subscribe to `player_state_changed` events for
 *    near-instant updates with no polling.
 *
 * 2. **Web API fallback**: Poll `/me/player/currently-playing` every 3 seconds.
 *    Requires user OAuth (PKCE flow). Scopes: `user-read-currently-playing user-read-playback-state`.
 *
 * Platform support:
 * - Windows: Both strategies
 * - macOS: Both strategies
 * - Linux: Both strategies
 *
 * @see {@link https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track} Spotify Web API
 */
export class SpotifySource extends EventEmitter implements ISource {
  readonly id = 'spotify';
  readonly displayName = 'Spotify';

  private _state: SourceState = { status: 'unavailable', track: null };
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this._pollInterval !== null) return;
    // TODO(spotify): Attempt local WebSocket first, fall back to Web API polling
    this._startPolling();
  }

  async stop(): Promise<void> {
    this._stopPolling();
    this._setState({ status: 'stopped', track: null });
  }

  getState(): SourceState {
    return this._state;
  }

  private _startPolling(): void {
    this._stopPolling();
    this._pollInterval = setInterval(() => { void this._poll(); }, 3_000);
    void this._poll();
  }

  private _stopPolling(): void {
    if (this._pollInterval !== null) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  private async _poll(): Promise<void> {
    try {
      const track = await this._fetchNowPlaying();
      this._reconcile(track);
    } catch (err) {
      if (err instanceof SourceAuthError) {
        this._setState({ status: 'auth-required', track: null });
        this._stopPolling();
      } else {
        console.warn(`[${this.id}] Poll failed:`, err);
      }
    }
  }

  private async _fetchNowPlaying(): Promise<TrackMetadata | null> {
    // TODO(spotify): Implement Web API call with token refresh
    throw new SourceUnavailableError(this.id, 'Not yet implemented');
  }

  private _reconcile(track: TrackMetadata | null): void {
    if (track === null) {
      if (this._state.status !== 'stopped') {
        this._setState({ status: 'stopped', track: null });
        this.emit('stopped');
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

  private _setState(state: SourceState): void {
    this._state = state;
  }
}
