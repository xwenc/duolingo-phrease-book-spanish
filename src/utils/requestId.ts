/** UUID v4 used only as a non-secret, per-user attempt idempotency key. */
export function createRequestId(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof provider?.getRandomValues === 'function') {
    // Unlike randomUUID, getRandomValues is available on LAN HTTP in modern browsers.
    provider.getRandomValues(bytes);
  } else {
    // Legacy browser fallback; these IDs never authorize access or act as tokens.
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
    const counter = ++fallbackCounter;
    for (let index = 0; index < 4; index++) bytes[12 + index] ^= counter >>> (index * 8) & 255;
  }
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let fallbackCounter = 0;
