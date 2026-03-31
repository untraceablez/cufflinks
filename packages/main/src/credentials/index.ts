import { safeStorage } from 'electron';
import { NoCredentialStorageError } from '@cufflinks/shared';

/**
 * @summary Keys for all credentials stored in the OS keychain or safeStorage fallback.
 *
 * @remarks
 * Never add raw token strings to electron-store. All secrets must flow through
 * a `CredentialStore` implementation.
 */
export type CredentialKey =
  | 'spotify.refreshToken'
  | 'spotify.accessToken'
  | 'spotify.accessTokenExpiry'
  | 'lastfm.sessionKey';

/**
 * @summary Unified read/write/clear interface for credential storage.
 *
 * @remarks
 * The backing implementation is selected at startup based on platform availability.
 * All credential access in the main process goes through this interface — no code
 * outside `credentials/` should import `keytar` or `safeStorage` directly.
 */
export interface CredentialStore {
  /**
   * @summary Reads a credential by key.
   * @param key - The credential key to look up.
   * @returns The stored value, or null if not found.
   */
  get(key: CredentialKey): Promise<string | null>;

  /**
   * @summary Writes or updates a credential.
   * @param key - The credential key.
   * @param value - The value to store. Must not be logged.
   */
  set(key: CredentialKey, value: string): Promise<void>;

  /**
   * @summary Deletes a single credential entry.
   * @param key - The credential key to remove.
   */
  delete(key: CredentialKey): Promise<void>;

  /**
   * @summary Deletes all stored Cufflinks credentials. Used on full sign-out.
   */
  clear(): Promise<void>;
}

let _resolvedStore: CredentialStore | null = null;

/**
 * @summary Selects and returns the best available credential storage backend.
 *
 * @remarks
 * Selection order:
 * 1. OS keychain via `keytar` (preferred — most secure)
 * 2. `safeStorage` + encrypted electron-store (fallback for headless/minimal Linux)
 *
 * Throws `NoCredentialStorageError` if neither backend is available, which
 * should surface a warning in the Settings UI.
 *
 * @throws {NoCredentialStorageError} If no secure backend is available.
 */
async function resolveBackend(): Promise<CredentialStore> {
  try {
    // Dynamic import so keytar's native addon only loads if the keychain is available
    const keytar = await import('keytar');
    // Probe to confirm the keychain is actually accessible
    await keytar.findCredentials('Cufflinks-probe');
    const { keychainBackend } = await import('./keychain.js');
    return keychainBackend;
  } catch {
    // keytar unavailable or keychain locked — try safeStorage
  }

  if (safeStorage.isEncryptionAvailable()) {
    const { safeStorageBackend } = await import('./fallback.js');
    return safeStorageBackend;
  }

  throw new NoCredentialStorageError();
}

/**
 * @summary Lazily-initialized singleton credential store.
 *
 * @remarks
 * Call `getCredentialStore()` to obtain the instance. The first call resolves
 * the backend; subsequent calls return the cached instance.
 *
 * @returns The active CredentialStore implementation.
 * @throws {NoCredentialStorageError} If no secure backend is available.
 */
export async function getCredentialStore(): Promise<CredentialStore> {
  if (_resolvedStore === null) {
    _resolvedStore = await resolveBackend();
  }
  return _resolvedStore;
}
