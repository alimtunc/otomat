/** Bytes that sniff as a PNG; the fake runtime never decodes them, so the signature is all a test needs. */
export function fakePng(size = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}
