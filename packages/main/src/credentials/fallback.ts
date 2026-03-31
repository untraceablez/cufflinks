import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { CredentialStore, CredentialKey } from './index.js';

/**
 * @summary CredentialStore implementation backed by Electron's `safeStorage` API.
 *
 * @remarks
 * Used on systems where the OS keychain is unavailable (e.g. headless Linux
 * without libsecret). `safeStorage` uses OS-level encryption:
 * - Windows: DPAPI
 * - macOS: Keychain (indirect — same as keytar in practice)
 * - Linux: libsecret with a derived key, or an internal Chromium key fallback
 *
 * Encrypted blobs are stored in a separate `credentials-enc` electron-store file,
 * never mixed with the plain settings store.
 */

// Separate store file so encrypted blobs never appear alongside plain settings
const encStore = new Store<Record<string, number[]>>({ name: 'credentials-enc' });

export const safeStorageBackend: CredentialStore = {
  async get(key: CredentialKey): Promise<string | null> {
    const blob = encStore.get(key) as number[] | undefined;
    if (blob === undefined) return null;
    return safeStorage.decryptString(Buffer.from(blob));
  },

  async set(key: CredentialKey, value: string): Promise<void> {
    const encrypted = safeStorage.encryptString(value);
    // Store as a plain array so electron-store can serialize it to JSON
    encStore.set(key, Array.from(encrypted));
  },

  async delete(key: CredentialKey): Promise<void> {
    encStore.delete(key);
  },

  async clear(): Promise<void> {
    encStore.clear();
  },
};
