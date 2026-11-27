/**
 * Client-side decryptor for public/data.enc using native Web Crypto API
 * and DecompressionStream('gzip').
 *
 * Binary layout:
 *  - Bytes  0..15 (16 bytes): random PBKDF2 salt
 *  - Bytes 16..27 (12 bytes): random AES-GCM IV (nonce)
 *  - Bytes 28..end: AES-256-GCM ciphertext (with 16-byte auth tag) of gzipped UTF-8 JSON
 *
 * Key derivation: PBKDF2-HMAC-SHA256, 100,000 iterations, 256-bit AES-GCM key.
 */
export async function fetchAndDecryptDataset(passphrase, url = './data.enc', onStatus = () => {}) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error(
      'Web Crypto API is unavailable. Please open this app over HTTPS or localhost.'
    )
  }

  onStatus('Downloading encrypted dataset...')
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(
      `Dataset file not found (HTTP ${res.status}). Make sure public/data.enc is deployed.`
    )
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength < 44) {
    throw new Error('Encrypted dataset file is corrupted or incomplete.')
  }

  const bytes = new Uint8Array(buffer)
  const salt = bytes.slice(0, 16)
  const iv = bytes.slice(16, 28)
  const ciphertext = bytes.slice(28)

  onStatus('Deriving decryption key...')
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  onStatus('Decrypting dataset...')
  let decryptedBuffer
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    )
  } catch {
    throw new Error('Invalid access key. Decryption failed.')
  }

  onStatus('Decompressing and parsing graph JSON...')
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Your browser does not support DecompressionStream (gzip).')
  }

  const ds = new DecompressionStream('gzip')
  const decompressedStream = new Blob([decryptedBuffer]).stream().pipeThrough(ds)
  const jsonText = await new Response(decompressedStream).text()
  return JSON.parse(jsonText)
}
