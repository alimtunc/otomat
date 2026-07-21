import { expect, it } from "vitest";

import {
  createLinearVault,
  LinearVaultUnavailableError,
  type LinearVaultIo,
} from "#shared/linear-vault";

const KEY = "lin_api_secret";

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

it("stores the key only in encrypted form", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);

  vault.save(KEY);

  expect(io.stored?.toString()).not.toBe(KEY);
  expect(io.stored?.toString()).toBe(`sealed:${KEY}`);
  expect(vault.load()).toBe(KEY);
});

it("forgets the key on clear", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);
  vault.save(KEY);

  vault.clear();

  expect(io.stored).toBeNull();
  expect(vault.load()).toBeNull();
});

it("refuses to save rather than falling back to plaintext when the keychain is unavailable", () => {
  const io = fakeIo({ isEncryptionAvailable: () => false });
  const vault = createLinearVault(io);

  expect(() => vault.save(KEY)).toThrow(LinearVaultUnavailableError);
  expect(io.stored).toBeNull();
});

it("treats ciphertext it can no longer decrypt as absent and drops it", () => {
  const io = fakeIo({
    decrypt: () => {
      throw new Error("decryption failed");
    },
  });
  const vault = createLinearVault(io);
  vault.save(KEY);

  expect(vault.load()).toBeNull();
  expect(io.stored).toBeNull();
});

it("reports no stored key before anything was saved", () => {
  const vault = createLinearVault(fakeIo());

  expect(vault.load()).toBeNull();
});
