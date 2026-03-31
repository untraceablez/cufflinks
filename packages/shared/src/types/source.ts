import type { TrackMetadata } from './track.js';

/**
 * @summary The operational status of a music source.
 *
 * @remarks
 * - `'active'`: Source is running and a track is currently playing.
 * - `'paused'`: Source is running but playback is paused.
 * - `'stopped'`: Source is running but nothing is playing.
 * - `'unavailable'`: The underlying player or API is not reachable.
 * - `'auth-required'`: The source needs valid credentials before it can start.
 */
export type SourceStatus = 'active' | 'paused' | 'stopped' | 'unavailable' | 'auth-required';

/**
 * @summary Snapshot of a source's current state.
 */
export interface SourceState {
  status: SourceStatus;
  /** @summary The currently playing track, or null if nothing is playing. */
  track: TrackMetadata | null;
}
