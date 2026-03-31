import type { CredentialStore, CredentialKey } from './index.js';

const SERVICE = 'Cufflinks';

/**
 * @summary CredentialStore implementation backed by the OS keychain via `keytar`.
 *
 * @remarks
 * Uses the system credential store natively:
 * - Windows: Windows Credential Manager
 * - macOS: Keychain
 * - Linux: libsecret (GNOME Keyring / KWallet)
 *
 * This is the preferred backend. Falls back to `safeStorageBackend` if unavailable.
 */
export const keychainBackend: CredentialStore = {
  async get(key: CredentialKey): Promise<string | null> {
    const keytar = await import('keytar');
    return keytar.getPassword(SERVICE, key);
  },

  async set(key: CredentialKey, value: string): Promise<void> {
    const keytar = await import('keytar');
    await keytar.setPassword(SERVICE, key, value);
  },

  async delete(key: CredentialKey): Promise<void> {
    const keytar = await import('keytar');
    await keytar.deletePassword(SERVICE, key);
  },

  async clear(): Promise<void> {
    const keytar = await import('keytar');
    const creds = await keytar.findCredentials(SERVICE);
    await Promise.all(creds.map((c) => keytar.deletePassword(SERVICE, c.account)));
  },
};
