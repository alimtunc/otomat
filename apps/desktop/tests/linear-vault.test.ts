import { LINEAR_DEFAULT_CONNECTION_ID } from "@otomat/domain";
import { expect, it, vi } from "vitest";

import {
  createLinearVault,
  LinearVaultUnavailableError,
  type LinearVaultIo,
} from "#shared/linear-vault";

interface StoredKeyHolder {
  stored: Buffer | null;
}

const KEY = "lin_api_secret";

function fakeIo(overrides: Partial<LinearVaultIo> = {}): LinearVaultIo & { stored: Buffer | null } {
  const state: StoredKeyHolder = { stored: null };
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

it("stores every connection's key only in encrypted form", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);

  vault.save("otomat", KEY);
  vault.save("crm", "lin_api_other");

  expect(io.stored?.toString()).toBe(
    `sealed:${JSON.stringify({ otomat: KEY, crm: "lin_api_other" })}`,
  );
  expect(vault.load()).toEqual({ otomat: KEY, crm: "lin_api_other" });
});

it("forgets one connection and leaves the others stored", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);
  vault.save("otomat", KEY);
  vault.save("crm", "lin_api_other");

  vault.forget("otomat");

  expect(vault.load()).toEqual({ crm: "lin_api_other" });
});

it("erases the file once the last connection is forgotten", () => {
  const io = fakeIo();
  const vault = createLinearVault(io);
  vault.save("otomat", KEY);

  vault.forget("otomat");

  expect(io.stored).toBeNull();
  expect(vault.load()).toEqual({});
});

it("reads a vault written as one bare key as the default connection", () => {
  const io = fakeIo();
  io.write(io.encrypt(KEY));

  expect(createLinearVault(io).load()).toEqual({ [LINEAR_DEFAULT_CONNECTION_ID]: KEY });
});

it("leaves the keychain untouched while no key is stored", () => {
  const isEncryptionAvailable = vi.fn(() => true);
  const vault = createLinearVault(fakeIo({ isEncryptionAvailable }));

  expect(vault.load()).toEqual({});
  expect(isEncryptionAvailable).not.toHaveBeenCalled();
});

it("refuses to save rather than falling back to plaintext when the keychain is unavailable", () => {
  const io = fakeIo({ isEncryptionAvailable: () => false });
  const vault = createLinearVault(io);

  expect(() => vault.save("otomat", KEY)).toThrow(LinearVaultUnavailableError);
  expect(io.stored).toBeNull();
});

it("treats ciphertext it can no longer decrypt as absent and drops it", () => {
  const io = fakeIo({
    decrypt: () => {
      throw new Error("decryption failed");
    },
  });
  const vault = createLinearVault(io);
  vault.save("otomat", KEY);

  expect(vault.load()).toEqual({});
  expect(io.stored).toBeNull();
});

it("reports no stored key before anything was saved", () => {
  expect(createLinearVault(fakeIo()).load()).toEqual({});
});
