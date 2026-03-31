/** @summary Identifies which music service provided this track. */
export type SourceId = 'spotify' | 'tidal' | 'apple-music' | 'unknown';

/**
 * @summary Normalized now-playing metadata emitted by all music sources.
 *
 * @remarks
 * All sources normalize their platform-specific data into this shape before
 * emitting events. The `id` field is source-prefixed (e.g. `"spotify:abc123"`)
 * to allow deduplication across sources.
 */
export interface TrackMetadata {
  /** @summary Deduplication key, source-prefixed. E.g. `"spotify:abc123"`. */
  id: string;
  title: string;
  artist: string;
  album: string;
  /** @summary Remote URL for the album art image, or null if unavailable. */
  albumArtUrl: string | null;
  /** @summary Local filesystem path to cached album art, or null if not yet cached. */
  albumArtLocalPath: string | null;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  source: SourceId;
  /** @summary Unix timestamp (ms) of when this metadata was last updated. */
  updatedAt: number;
}
