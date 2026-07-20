import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { safeStorage } from "electron";

import { createLinearVault, type LinearVault } from "#shared/linear-vault";

/** Distinctive name so the encrypted blob is never mistaken for daemon data sitting beside it. */
export const LINEAR_VAULT_FILENAME = "linear-credential.enc";

/** Binds the pure vault to Electron's keychain-backed safeStorage and a file under userData. */
export function createMainLinearVault(dataDir: string): LinearVault {
  const filePath = join(dataDir, LINEAR_VAULT_FILENAME);
  return createLinearVault({
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plainText) => safeStorage.encryptString(plainText),
    decrypt: (cipher) => safeStorage.decryptString(cipher),
    read() {
      try {
        return readFileSync(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    write: (cipher) => writeFileSync(filePath, cipher, { mode: 0o600 }),
    remove: () => rmSync(filePath, { force: true }),
  });
}
