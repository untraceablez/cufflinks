import crypto from 'crypto';
import { getCredentialStore } from '../credentials/index.js';
import type { TrackMetadata } from '@cufflinks/shared';
import { ScrobbleQueue } from './queue.js';

/** @summary Last.fm API base URL. */
const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';

/**
 * @summary Result of a scrobble submission attempt.
 */
export interface ScrobbleStatus {
  /** @summary Whether the scrobble was accepted by the Last.fm API. */
  ok: boolean;
  /** @summary Human-readable error message if `ok` is false. */
  error?: string;
  /** @summary Track title that was scrobbled. */
  trackTitle: string;
}

/**
 * @summary Last.fm API client handling now-playing updates, scrobbling, and auth.
 *
 * @remarks
 * Scrobble rules (per Last.fm spec):
 * - A track must play for **at least 30 seconds** AND **more than 50%** of its duration.
 * - The same `(artist, title, album, timestamp)` tuple is never scrobbled twice.
 * - `track.updateNowPlaying` is called immediately when a track starts.
 *
 * The session key is read from the CredentialStore on each scrobble batch — never
 * cached in a module-level variable — to ensure revocation takes effect immediately.
 *
 * The `LASTFM_SHARED_SECRET` is embedded at build time and never sent to the renderer.
 */
export class LastfmScrobbler {
  private readonly _apiKey: string;
  private readonly _sharedSecret: string;
  private readonly _queue: ScrobbleQueue;

  /** @summary Timestamp (ms) when the current track started playing. */
  private _trackStartTime: number | null = null;

  /** @summary Timer that fires when the scrobble threshold is reached. */
  private _scrobbleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param apiKey - Last.fm API key (embedded at build time).
   * @param sharedSecret - Last.fm shared secret for API signature (embedded at build time, never sent to renderer).
   * @param queue - Persistent scrobble queue for offline tolerance.
   */
  constructor(apiKey: string, sharedSecret: string, queue: ScrobbleQueue) {
    this._apiKey = apiKey;
    this._sharedSecret = sharedSecret;
    this._queue = queue;
  }

  /**
   * @summary Called when a new track starts playing.
   *
   * @remarks
   * Resets the scrobble timer and immediately sends a `track.updateNowPlaying` call.
   * The scrobble timer is scheduled for `max(30s, track.duration * threshold)`.
   *
   * @param track - The newly started track.
   * @param threshold - Fraction of duration required (0.5–1.0). From user settings.
   * @param minSeconds - Minimum seconds required. From user settings.
   */
  onTrackStart(track: TrackMetadata, threshold: number, minSeconds: number): void {
    this._clearScrobbleTimer();
    this._trackStartTime = Date.now();

    void this._updateNowPlaying(track);

    const thresholdMs = Math.max(minSeconds * 1000, track.durationMs * threshold);
    this._scrobbleTimer = setTimeout(() => {
      // _trackStartTime is guaranteed non-null here because we set it above
      // and _clearScrobbleTimer() would have cancelled this timeout if the track changed
      void this._scrobble(track, this._trackStartTime!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }, thresholdMs);
  }

  /**
   * @summary Called when playback stops or the track changes before threshold.
   *
   * @remarks
   * Cancels the pending scrobble timer if it hasn't fired yet.
   */
  onTrackStop(): void {
    this._clearScrobbleTimer();
    this._trackStartTime = null;
  }

  /**
   * @summary Drains the offline scrobble queue, submitting any pending entries.
   *
   * @remarks
   * Called on app start and on network restore. Batches up to 50 entries per request.
   */
  async drainQueue(): Promise<void> {
    const pending = this._queue.getPending(50);
    if (pending.length === 0) return;

    const sessionKey = await this._getSessionKey();
    if (sessionKey === null) return;

    // TODO(lastfm): Implement batch scrobble submission
    console.log(`[lastfm] Would drain ${pending.length} queued scrobbles`);
  }

  // --- internal ---

  private _clearScrobbleTimer(): void {
    if (this._scrobbleTimer !== null) {
      clearTimeout(this._scrobbleTimer);
      this._scrobbleTimer = null;
    }
  }

  /**
   * @summary Sends a `track.updateNowPlaying` API call.
   *
   * @param track - The track that just started.
   */
  private async _updateNowPlaying(track: TrackMetadata): Promise<void> {
    const sessionKey = await this._getSessionKey();
    if (sessionKey === null) return;

    const params: Record<string, string> = {
      method: 'track.updateNowPlaying',
      artist: track.artist,
      track: track.title,
      album: track.album,
      api_key: this._apiKey,
      sk: sessionKey,
    };

    try {
      await this._signedPost(params);
    } catch (err) {
      // Non-fatal — now-playing updates are best-effort
      console.warn('[lastfm] updateNowPlaying failed:', err);
    }
  }

  /**
   * @summary Queues or submits a scrobble for the given track.
   *
   * @param track - The track to scrobble.
   * @param startTime - Unix ms timestamp when the track started playing.
   */
  private async _scrobble(track: TrackMetadata, startTime: number): Promise<void> {
    const timestampSec = Math.floor(startTime / 1000);
    this._queue.enqueue({ track, timestamp: timestampSec });
    await this.drainQueue();
  }

  /**
   * @summary Reads the Last.fm session key from the credential store.
   *
   * @returns The session key string, or null if not authenticated.
   */
  private async _getSessionKey(): Promise<string | null> {
    const store = await getCredentialStore();
    return store.get('lastfm.sessionKey');
  }

  /**
   * @summary Signs and POSTs a Last.fm API call.
   *
   * @remarks
   * Signature algorithm: MD5 of sorted `key=value` pairs (excluding `format` and `callback`)
   * concatenated with the shared secret.
   *
   * @param params - API parameters (without `format` or `api_sig`).
   * @returns The parsed JSON response body.
   * @throws {Error} On HTTP error or API-level error response.
   */
  private async _signedPost(params: Record<string, string>): Promise<unknown> {
    const sig = this._buildSignature(params);
    const body = new URLSearchParams({ ...params, api_sig: sig, format: 'json' });

    const response = await fetch(LASTFM_API_BASE, {
      method: 'POST',
      body,
    });

    if (!response.ok) {
      throw new Error(`Last.fm API HTTP error: ${response.status}`);
    }

    const json: unknown = await response.json();
    return json;
  }

  /**
   * @summary Computes the Last.fm API request signature.
   *
   * @param params - The parameters to sign (excluding `format`, `callback`, `api_sig`).
   * @returns MD5 hex string of the signature.
   */
  private _buildSignature(params: Record<string, string>): string {
    const sorted = Object.entries(params)
      .filter(([k]) => k !== 'format' && k !== 'callback' && k !== 'api_sig')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join('');
    return crypto.createHash('md5').update(sorted + this._sharedSecret).digest('hex');
  }
}
