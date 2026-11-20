// Only the Web Crypto operation actually used by the original UI is exposed.
export const randomUUID=()=>globalThis.crypto.randomUUID()
