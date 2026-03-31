import { EventEmitter } from 'events';
import type { ISource } from './base.js';
import type { TrackMetadata, SourceState } from '@cufflinks/shared';
import { SpotifySource } from './spotify.js';
import { TidalSource } from './tidal.js';
import { AppleMusicSource } from './apple-music.js';

/**
 * @summary Manages all music source plugins and emits unified now-playing events.
 *
 * @remarks
 * The manager maintains a priority-ordered list of sources. The first source
 * whose status is `'active'` or `'paused'` wins; all other sources are polled
 * but suppressed. When no source is active, the manager emits `null`.
 *
 * Track-change events are debounced by 300ms to avoid flicker during rapid
 * seek operations, which can fire many state updates within milliseconds.
 */
export class SourceManager extends EventEmitter {
  /** @summary Ordered list of all registered sources. Reordered by user priority settings. */
  private _sources: ISource[];

  /** @summary Debounce timer for track-change events. */
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** @summary The last track emitted via `'now-playing-changed'`. Used to suppress duplicates. */
  private _lastEmittedTrack: TrackMetadata | null = null;

  constructor() {
    super();
    this._sources = [
      new SpotifySource(),
      new TidalSource(),
      new AppleMusicSource(),
    ];

    for (const source of this._sources) {
      source.on('track-change', (track) => this._onSourceTrackChange(source, track));
      source.on('playback-change', (track) => this._onSourceTrackChange(source, track));
      source.on('stopped', () => this._onSourceStopped(source));
    }
  }

  /**
   * @summary Starts all enabled sources.
   *
   * @remarks
   * Sources that fail to start (e.g. auth required, player unavailable) log a
   * warning but do not prevent other sources from starting.
   */
  async startAll(): Promise<void> {
    await Promise.allSettled(
      this._sources.map(async (s) => {
        try {
          await s.start();
        } catch (err) {
          console.warn(`[source-manager] Failed to start source '${s.id}':`, err);
        }
      }),
    );
  }

  /**
   * @summary Stops all sources cleanly.
   */
  async stopAll(): Promise<void> {
    await Promise.allSettled(this._sources.map((s) => s.stop()));
  }

  /**
   * @summary Returns the state of all sources, keyed by source ID.
   *
   * @returns A map from source ID to its current SourceState.
   */
  getAllStates(): Record<string, SourceState> {
    return Object.fromEntries(this._sources.map((s) => [s.id, s.getState()]));
  }

  /**
   * @summary Reorders sources according to a user-specified priority list.
   *
   * @param priority - Array of source IDs in priority order (highest priority first).
   */
  setPriority(priority: string[]): void {
    this._sources.sort((a, b) => {
      const ai = priority.indexOf(a.id);
      const bi = priority.indexOf(b.id);
      // Sources not in the list go to the end
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }

  // --- internal ---

  /**
   * @summary Handles a track-change or playback-change event from a source.
   *
   * @remarks
   * Only propagates the event if the source is the highest-priority active source.
   * Debounces by 300ms to avoid flicker from rapid seek events.
   *
   * @param source - The source that emitted the event.
   * @param track - The updated track metadata.
   */
  private _onSourceTrackChange(source: ISource, track: TrackMetadata): void {
    if (!this._isActiveSource(source)) return;

    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._emit(track);
    }, 300);
  }

  /**
   * @summary Handles a `'stopped'` event from a source.
   *
   * @param source - The source that stopped.
   */
  private _onSourceStopped(source: ISource): void {
    if (!this._isActiveSource(source)) return;
    this._emit(null);
  }

  /**
   * @summary Emits `'now-playing-changed'` if the track has actually changed.
   *
   * @param track - The new track, or null if nothing is playing.
   */
  private _emit(track: TrackMetadata | null): void {
    if (track?.id === this._lastEmittedTrack?.id && track?.isPlaying === this._lastEmittedTrack?.isPlaying) {
      return;
    }
    this._lastEmittedTrack = track;
    this.emit('now-playing-changed', track);
  }

  /**
   * @summary Checks whether the given source is the highest-priority active source.
   *
   * @param source - The source to check.
   * @returns True if this source should currently be the one producing output.
   */
  private _isActiveSource(source: ISource): boolean {
    for (const s of this._sources) {
      const status = s.getState().status;
      if (status === 'active' || status === 'paused') {
        return s.id === source.id;
      }
    }
    return false;
  }
}
