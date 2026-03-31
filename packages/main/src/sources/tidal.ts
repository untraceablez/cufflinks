import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { SourceState, TrackMetadata } from '@cufflinks/shared';
import { SourceUnavailableError } from '@cufflinks/shared';

/**
 * @summary Music source plugin for TIDAL.
 *
 * @remarks
 * TIDAL has no official desktop now-playing API. This source tries multiple
 * adapters in priority order, using the first one that succeeds:
 *
 * 1. **Windows SMTC**: `GlobalSystemMediaTransportControlsSession` via native Node addon.
 * 2. **macOS MediaRemote**: Private Apple framework via Swift helper (limited support).
 * 3. **tidal-hifi local API**: Community Electron client exposes REST on port `47836`.
 *
 * Platform support:
 * - Windows: SMTC (primary), tidal-hifi fallback
 * - macOS: MediaRemote (experimental), tidal-hifi fallback
 * - Linux: tidal-hifi only
 */
export class TidalSource extends EventEmitter implements ISource {
  readonly id = 'tidal';
  readonly displayName = 'TIDAL';

  private _state: SourceState = { status: 'unavailable', track: null };
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this._pollInterval !== null) return;
    // TODO(tidal): Probe adapters (SMTC → MediaRemote → tidal-hifi) and start the best one
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
      console.warn(`[${this.id}] Poll failed:`, err);
    }
  }

  private async _fetchNowPlaying(): Promise<TrackMetadata | null> {
    // TODO(tidal): Implement adapter chain
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
