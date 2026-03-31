import path from 'path';
import { app } from 'electron';
import type { TrackMetadata } from '@cufflinks/shared';

/**
 * @summary A single pending scrobble entry waiting to be submitted to Last.fm.
 */
export interface PendingScrobble {
  track: TrackMetadata;
  /** @summary Unix timestamp (seconds) when the track started playing. */
  timestamp: number;
}

/**
 * @summary Offline-tolerant scrobble queue backed by SQLite (better-sqlite3).
 *
 * @remarks
 * Entries are persisted across app restarts in `userData/scrobbles.db`.
 * On network restore or app start, the caller should call `drainQueue()` on
 * `LastfmScrobbler`, which reads from this queue.
 *
 * Entries are kept indefinitely until successfully submitted. The deduplication
 * key is `(artist, title, album, timestamp)` — matching the Last.fm scrobble spec.
 */
export class ScrobbleQueue {
  private _db: import('better-sqlite3').Database | null = null;

  /**
   * @summary Opens (or creates) the SQLite database and applies the schema.
   *
   * @remarks
   * Must be called once before any other method. Idempotent — safe to call
   * on every app start.
   */
  open(): void {
    // Dynamic import so the native addon only loads when the scrobbler is enabled
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const dbPath = path.join(app.getPath('userData'), 'scrobbles.db');
    this._db = new Database(dbPath);
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS scrobble_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        title TEXT NOT NULL,
        album TEXT NOT NULL,
        timestamp_sec INTEGER NOT NULL,
        track_json TEXT NOT NULL,
        UNIQUE(artist, title, album, timestamp_sec)
      );
    `);
  }

  /**
   * @summary Adds a scrobble entry to the queue if it hasn't been queued before.
   *
   * @remarks
   * Uses `INSERT OR IGNORE` to enforce the deduplication constraint on
   * `(artist, title, album, timestamp_sec)`.
   *
   * @param entry - The scrobble to enqueue.
   */
  enqueue(entry: PendingScrobble): void {
    if (this._db === null) throw new Error('ScrobbleQueue not opened');
    this._db
      .prepare(`
        INSERT OR IGNORE INTO scrobble_queue (artist, title, album, timestamp_sec, track_json)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        entry.track.artist,
        entry.track.title,
        entry.track.album,
        entry.timestamp,
        JSON.stringify(entry.track),
      );
  }

  /**
   * @summary Returns up to `limit` pending scrobble entries, oldest first.
   *
   * @param limit - Maximum number of entries to return (Last.fm accepts up to 50 per batch).
   * @returns Array of pending scrobbles.
   */
  getPending(limit: number): PendingScrobble[] {
    if (this._db === null) throw new Error('ScrobbleQueue not opened');
    const rows = this._db
      .prepare('SELECT id, track_json, timestamp_sec FROM scrobble_queue ORDER BY id ASC LIMIT ?')
      .all(limit) as Array<{ id: number; track_json: string; timestamp_sec: number }>;

    return rows.map((row) => ({
      track: JSON.parse(row.track_json) as TrackMetadata,
      timestamp: row.timestamp_sec,
    }));
  }

  /**
   * @summary Removes successfully submitted scrobbles from the queue.
   *
   * @param entries - The entries to remove, identified by `(artist, title, album, timestamp)`.
   */
  markSubmitted(entries: PendingScrobble[]): void {
    if (this._db === null) throw new Error('ScrobbleQueue not opened');
    const del = this._db.prepare(
      'DELETE FROM scrobble_queue WHERE artist = ? AND title = ? AND album = ? AND timestamp_sec = ?',
    );
    const deleteAll = this._db.transaction((items: PendingScrobble[]) => {
      for (const item of items) {
        del.run(item.track.artist, item.track.title, item.track.album, item.timestamp);
      }
    });
    deleteAll(entries);
  }
}
