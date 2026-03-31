/**
 * @summary Base class for all typed Cufflinks application errors.
 *
 * @remarks
 * Never throw raw strings or plain `Error` instances from Cufflinks code.
 * Use a subclass of `CufflinksError` so that catch handlers can distinguish
 * application errors from unexpected runtime errors.
 */
export class CufflinksError extends Error {
  constructor(
    message: string,
    /** @summary Machine-readable error code used for UI message lookup. */
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CufflinksError';
  }
}

/**
 * @summary Thrown when a music source requires authentication that is absent or expired.
 */
export class SourceAuthError extends CufflinksError {
  /**
   * @param sourceId - The source that requires auth, e.g. `'spotify'`.
   */
  constructor(public readonly sourceId: string) {
    super(`Source '${sourceId}' requires authentication.`, 'SOURCE_AUTH_REQUIRED');
    this.name = 'SourceAuthError';
  }
}

/**
 * @summary Thrown when a music source's underlying player or API is unreachable.
 */
export class SourceUnavailableError extends CufflinksError {
  /**
   * @param sourceId - The source that is unavailable.
   * @param reason - Human-readable explanation, e.g. `'Player process not running'`.
   */
  constructor(
    public readonly sourceId: string,
    reason: string,
  ) {
    super(`Source '${sourceId}' is unavailable: ${reason}`, 'SOURCE_UNAVAILABLE');
    this.name = 'SourceUnavailableError';
  }
}

/**
 * @summary Thrown when a theme file path resolves outside the theme's root directory.
 *
 * @remarks
 * This indicates a path traversal attempt, either from a malicious `theme.json`
 * or a bug in theme-loading code. Always caught at the boundary and logged.
 */
export class ThemePathError extends CufflinksError {
  /**
   * @param themeId - The theme whose manifest triggered the error.
   * @param attemptedPath - The path that caused the violation.
   */
  constructor(themeId: string, attemptedPath: string) {
    super(
      `Path traversal detected in theme '${themeId}': ${attemptedPath}`,
      'THEME_PATH_TRAVERSAL',
    );
    this.name = 'ThemePathError';
  }
}

/**
 * @summary Thrown when no secure credential storage backend is available on the system.
 *
 * @remarks
 * Occurs on Linux systems without libsecret/kwallet and without safeStorage support.
 * The UI should display a clear warning and prevent auth flows from proceeding.
 */
export class NoCredentialStorageError extends CufflinksError {
  constructor() {
    super(
      'No secure credential storage is available on this system.',
      'NO_CREDENTIAL_STORAGE',
    );
    this.name = 'NoCredentialStorageError';
  }
}
