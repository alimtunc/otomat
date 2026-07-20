import { expect, it } from "vitest";

import {
  createLinearVault,
  LinearVaultUnavailableError,
  type LinearVaultIo,
} from "#shared/linear-vault";

const KEY = "lin_api_secret";

/** In-memory safeStorage stand-in: "encryption" is a reversible marker so the test can prove no plaintext is stored. */
function fakeIo(overrides: Partial<LinearVaultIo> = {}): LinearVaultIo & { stored: Buffer | null } {
  const state: { stored: Buffer | null } = { stored: null };
  return {
    get stored() {
      return state.stored;
    },
    isEncryptionAvailable: () => true,
    encrypt: (plainText) => Buffer.from(`sealed:${plainText}`),
    decrypt: (cipher) => cipher.toString().replace(/^sealed:/, ""),
    read: () => state.stored,
    write: (cipher) => {
      state.stored = cipher;
    },
    remove: () => {
      state.stored = null;
    },
    ...overrides,
  };
}

it("stores the key only in encrypted form and reports that one exists", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);

  expect(vault.status()).toEqual({ encryption_available: true, has_stored_key: false });
  vault.save(KEY);

  expect(io.stored?.toString()).not.toBe(KEY);
  expect(io.stored?.toString()).toBe(`sealed:${KEY}`);
  expect(vault.status()).toEqual({ encryption_available: true, has_stored_key: true });
  expect(vault.load()).toBe(KEY);
});

it("forgets the key on clear", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);
  vault.save(KEY);

  vault.clear();

  expect(io.stored).toBeNull();
  expect(vault.load()).toBeNull();
  expect(vault.status().has_stored_key).toBe(false);
});

it("refuses to save rather than falling back to plaintext when the keychain is unavailable", () => {
  const io = fakeIo({ isEncryptionAvailable: () => false });
  const vault = createLinearVault(io);

  expect(() => vault.save(KEY)).toThrow(LinearVaultUnavailableError);
  expect(io.stored).toBeNull();
  expect(vault.status()).toEqual({ encryption_available: false, has_stored_key: false });
});

it("treats ciphertext it can no longer decrypt as absent and drops it", () => {
  const io = fakeIo({
    decrypt: () => {
      throw new Error("decryption failed");
    },
  });
  const vault = createLinearVault(io);
  vault.save(KEY);

  // A re-signed build cannot open the previous blob; that must read as "connect
  // again", not as a crash on every launch.
  expect(vault.load()).toBeNull();
  expect(io.stored).toBeNull();
});

it("reports no stored key before anything was saved", () => {
  const vault = createLinearVault(fakeIo());

  expect(vault.load()).toBeNull();
});
