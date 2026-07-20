/** What the renderer may know about the stored key: whether one exists, never its value. */
export interface LinearVaultStatus {
  encryption_available: boolean;
  has_stored_key: boolean;
}

export interface LinearVaultIo {
  isEncryptionAvailable(): boolean;
  encrypt(plainText: string): Buffer;
  decrypt(cipher: Buffer): string;
  read(): Buffer | null;
  write(cipher: Buffer): void;
  remove(): void;
}

export interface LinearVault {
  status(): LinearVaultStatus;
  save(apiKey: string): void;
  /** Null when nothing is stored, encryption is unavailable, or the ciphertext no longer decrypts. */
  load(): string | null;
  clear(): void;
}

export class LinearVaultUnavailableError extends Error {
  constructor() {
    super("This system has no secure storage available, so the Linear key cannot be saved.");
    this.name = "LinearVaultUnavailableError";
  }
}

/**
 * Encrypted-at-rest holder for the Linear Personal API key. `save` refuses rather
 * than falling back to plaintext when the OS keychain is unavailable, and `load`
 * treats an undecryptable file as absent — re-signing the app rotates the key
 * that protects it, which must read as "connect again", not as a crash.
 */
export function createLinearVault(io: LinearVaultIo): LinearVault {
  return {
    status() {
      const encryptionAvailable = io.isEncryptionAvailable();
      return {
        encryption_available: encryptionAvailable,
        has_stored_key: encryptionAvailable && io.read() !== null,
      };
    },

    save(apiKey: string) {
      if (!io.isEncryptionAvailable()) throw new LinearVaultUnavailableError();
      io.write(io.encrypt(apiKey));
    },

    load() {
      if (!io.isEncryptionAvailable()) return null;
      const cipher = io.read();
      if (cipher === null) return null;
      try {
        const apiKey = io.decrypt(cipher);
        return apiKey === "" ? null : apiKey;
      } catch {
        // Stale ciphertext from a differently-signed build; drop it so the user
        // is asked to connect again instead of failing on every launch.
        io.remove();
        return null;
      }
    },

    clear() {
      io.remove();
    },
  };
}
