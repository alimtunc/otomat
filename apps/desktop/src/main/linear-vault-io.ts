import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { safeStorage } from "electron";

import { createLinearVault, type LinearVault } from "#shared/linear-vault";

const LINEAR_VAULT_FILENAME = "linear-credential.enc";

function hasErrorCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

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
        if (hasErrorCode(error) && error.code === "ENOENT") return null;
        throw error;
      }
    },
    write: (cipher) => writeFileSync(filePath, cipher, { mode: 0o600 }),
    remove: () => rmSync(filePath, { force: true }),
  });
}
