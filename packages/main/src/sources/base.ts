import type { SourceState } from '@cufflinks/shared';
import type { TrackMetadata } from '@cufflinks/shared';
import { EventEmitter } from 'events';

export { SourceAuthError, SourceUnavailableError } from '@cufflinks/shared';

/**
 * @summary Contract that all music source plugins must implement.
 *
 * @remarks
 * Sources are EventEmitter subclasses so the manager can subscribe to
 * `'track-change'`, `'playback-change'`, and `'stopped'` events without polling.
 * Each source is responsible for its own polling or event subscription internally.
 */
export interface ISource extends EventEmitter {
  /** @summary Unique, stable identifier for this source. Matches `SourceId` values. */
  readonly id: string;
  /** @summary Human-readable name displayed in the Settings UI. */
  readonly displayName: string;

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

  /**
   * @summary Stops all polling and event listeners for this source.
   *
   * @remarks
   * Idempotent. Safe to call when already stopped.
   */
  stop(): Promise<void>;

  /**
   * @summary Returns a snapshot of the current source state.
   *
   * @returns Current `SourceState` including status and active track.
   */
  getState(): SourceState;

  on(event: 'track-change', listener: (track: TrackMetadata) => void): this;
  on(event: 'playback-change', listener: (track: TrackMetadata) => void): this;
  on(event: 'stopped', listener: () => void): this;
}
