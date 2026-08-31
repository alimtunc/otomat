import { LINEAR_DEFAULT_CONNECTION_ID } from "@otomat/domain";

export interface LinearVaultIo {
  isEncryptionAvailable(): boolean;
  encrypt(plainText: string): Buffer;
  decrypt(cipher: Buffer): string;
  read(): Buffer | null;
  write(cipher: Buffer): void;
  remove(): void;
}

/** Every catalogued connection's key, by connection id. */
export type LinearVaultKeys = Record<string, string>;

export interface LinearVault {
  save(connectionId: string, apiKey: string): void;
  load(): LinearVaultKeys;
  forget(connectionId: string): void;
}

export class LinearVaultUnavailableError extends Error {
  constructor() {
    super("This system has no secure storage available, so the Linear key cannot be saved.");
    this.name = "LinearVaultUnavailableError";
  }
}

/** A vault written before the catalogue held one bare key, which is the default connection's. */
function parseKeys(plainText: string): LinearVaultKeys {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plainText);
  } catch {
    return plainText === "" ? {} : { [LINEAR_DEFAULT_CONNECTION_ID]: plainText };
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

export function createLinearVault(io: LinearVaultIo): LinearVault {
  const read = (): LinearVaultKeys => {
    if (!io.isEncryptionAvailable()) return {};
    const cipher = io.read();
    if (cipher === null) return {};
    try {
      return parseKeys(io.decrypt(cipher));
    } catch {
      // App re-signing can rotate the keychain key, making old ciphertext unrecoverable.
      io.remove();
      return {};
    }
  };

  const write = (keys: LinearVaultKeys): void => {
    if (Object.keys(keys).length === 0) {
      io.remove();
      return;
    }
    io.write(io.encrypt(JSON.stringify(keys)));
  };

  return {
    save(connectionId: string, apiKey: string) {
      if (!io.isEncryptionAvailable()) throw new LinearVaultUnavailableError();
      write({ ...read(), [connectionId]: apiKey });
    },

    load: read,

    forget(connectionId: string) {
      const keys = read();
      delete keys[connectionId];
      write(keys);
    },
  };
}
