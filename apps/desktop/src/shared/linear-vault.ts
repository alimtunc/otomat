export interface LinearVaultIo {
  isEncryptionAvailable(): boolean;
  encrypt(plainText: string): Buffer;
  decrypt(cipher: Buffer): string;
  read(): Buffer | null;
  write(cipher: Buffer): void;
  remove(): void;
}

export interface LinearVault {
  save(apiKey: string): void;
  load(): string | null;
  clear(): void;
}

export class LinearVaultUnavailableError extends Error {
  constructor() {
    super("This system has no secure storage available, so the Linear key cannot be saved.");
    this.name = "LinearVaultUnavailableError";
  }
}

export function createLinearVault(io: LinearVaultIo): LinearVault {
  return {
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
        // App re-signing can rotate the keychain key, making old ciphertext unrecoverable.
        io.remove();
        return null;
      }
    },

    clear() {
      io.remove();
    },
  };
}
