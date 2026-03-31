import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { SourceState, TrackMetadata } from '@cufflinks/shared';
import { SourceUnavailableError } from '@cufflinks/shared';

/**
 * @summary Music source plugin for Apple Music.
 *
 * @remarks
 * Platform support varies significantly:
 *
 * 1. **macOS (primary)**: Poll via JXA/AppleScript (`osascript`) every 2 seconds.
 *    Direct access to `Music.app` player state and artwork.
 *
 * 2. **Windows**: Use `GlobalSystemMediaTransportControlsSession` (SMTC) via the
 *    same native addon as TidalSource. Apple Music for Windows registers with SMTC.
 *
 * 3. **Linux**: Not supported. Apple Music is not available on Linux.
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/} JXA Scripting Guide
 */
export class AppleMusicSource extends EventEmitter implements ISource {
  readonly id = 'apple-music';
  readonly displayName = 'Apple Music';

  private _state: SourceState = { status: 'unavailable', track: null };
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (process.platform === 'linux') {
      this._setState({ status: 'unavailable', track: null });
      return;
    }
    if (this._pollInterval !== null) return;
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
    // Poll every 2 seconds — AppleScript is synchronous and relatively slow
    this._pollInterval = setInterval(() => { void this._poll(); }, 2_000);
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
      if (err instanceof SourceUnavailableError) {
        this._setState({ status: 'unavailable', track: null });
        this._stopPolling();
      } else {
        console.warn(`[${this.id}] Poll failed:`, err);
      }
    }
  }

  private async _fetchNowPlaying(): Promise<TrackMetadata | null> {
    if (process.platform === 'darwin') {
      // TODO(apple-music): Run osascript to get current track from Music.app
      throw new SourceUnavailableError(this.id, 'AppleScript integration not yet implemented');
    } else if (process.platform === 'win32') {
      // TODO(apple-music): Use SMTC native addon
      throw new SourceUnavailableError(this.id, 'SMTC integration not yet implemented');
    }
    throw new SourceUnavailableError(this.id, 'Not supported on this platform');
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
