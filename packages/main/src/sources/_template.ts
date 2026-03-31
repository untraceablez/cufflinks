import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { SourceState, TrackMetadata } from '@cufflinks/shared';
import { SourceAuthError, SourceUnavailableError } from '@cufflinks/shared';

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
export class TemplateSource extends EventEmitter implements ISource {
  readonly id = 'template';
  readonly displayName = 'Template Source';

  /**
   * @summary Current source state, including playback status and active track.
   * Updated on every poll cycle or event.
   */
  private _state: SourceState = { status: 'unavailable', track: null };

  /**
   * @summary Interval handle for the polling loop.
   * Null when the source is stopped.
   */
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  // --- ISource implementation ---

  /**
   * @summary Starts the polling loop for this source.
   *
   * @remarks
   * Idempotent — calling start() on an already-running source is a no-op.
   *
   * @throws {SourceAuthError} If credentials are missing or expired.
   * @throws {SourceUnavailableError} If the player is not running.
   */
  async start(): Promise<void> {
    if (this._pollInterval !== null) return;
    this._startPolling();
  }

  /**
   * @summary Stops the polling loop and resets state to `'stopped'`.
   */
  async stop(): Promise<void> {
    this._stopPolling();
    this._setState({ status: 'stopped', track: null });
  }

  /**
   * @summary Returns the current source state snapshot.
   *
   * @returns Current SourceState.
   */
  getState(): SourceState {
    return this._state;
  }

  // --- internal ---

  /**
   * @summary Starts the polling loop. Polls immediately, then on a 3-second interval.
   */
  private _startPolling(): void {
    this._stopPolling();
    this._pollInterval = setInterval(() => { void this._poll(); }, 3_000);
    void this._poll();
  }

  /**
   * @summary Clears the polling interval.
   */
  private _stopPolling(): void {
    if (this._pollInterval !== null) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  /**
   * @summary Fetches current playback state and emits change events if the
   * track or playback status has changed.
   */
  private async _poll(): Promise<void> {
    try {
      // TODO: Replace with actual API call
      const track = await this._fetchNowPlaying();
      this._reconcile(track);
    } catch (err) {
      if (err instanceof SourceAuthError) {
        this._setState({ status: 'auth-required', track: null });
        this._stopPolling();
      } else {
        // Transient error — log and continue polling
        console.warn(`[${this.id}] Poll failed:`, err);
      }
    }
  }

  /**
   * @summary Placeholder — replace with real API call.
   *
   * @returns The currently playing TrackMetadata, or null if nothing is playing.
   * @throws {SourceAuthError} On auth failure.
   * @throws {SourceUnavailableError} If the player is unreachable.
   */
  private async _fetchNowPlaying(): Promise<TrackMetadata | null> {
    throw new SourceUnavailableError(this.id, 'Not implemented');
  }

  /**
   * @summary Compares new track data against current state and emits the
   * appropriate event if anything changed.
   *
   * @param track - The latest TrackMetadata from the API, or null if nothing is playing.
   */
  private _reconcile(track: TrackMetadata | null): void {
    if (track === null) {
      if (this._state.status !== 'stopped') {
        this._setState({ status: 'stopped', track: null });
        this.emit('stopped');
      }
      return;
    }

    const prev = this._state.track;
    const isNewTrack = prev?.id !== track.id;
    const isPlaybackChange = prev?.isPlaying !== track.isPlaying;

    this._setState({ status: track.isPlaying ? 'active' : 'paused', track });

    if (isNewTrack) {
      this.emit('track-change', track);
    } else if (isPlaybackChange) {
      this.emit('playback-change', track);
    }
  }

  /**
   * @summary Updates internal state. Always use this instead of mutating `_state` directly.
   *
   * @param state - The new state to apply.
   */
  private _setState(state: SourceState): void {
    this._state = state;
  }
}
