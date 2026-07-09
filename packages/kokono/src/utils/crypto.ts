import crypto from 'node:crypto';

export interface EncryptedData {
  key: string; // Base64 encoded raw X25519 public key (32 bytes)
  iv: string; // Base64 encoded 12-byte IV
  ciphertext: string; // Base64 encoded ciphertext
  tag: string; // Base64 encoded 16-byte authentication tag
}

/**
 * Encrypts a message using ECIES Curve25519 (X25519) + AES-256-GCM.
 */
export function encrypt(
  recipientPublicKeyB64: string,
  message: string,
): EncryptedData {
  const recipientPublicKey = Buffer.from(recipientPublicKeyB64, 'base64');

  // 1. Generate ephemeral key pair
  const {
    publicKey: ephemeralPublicKeyObj,
    privateKey: ephemeralPrivateKeyObj,
  } = crypto.generateKeyPairSync('x25519');

  // Export raw public key via SPKI der slice
  const ephemeralPublicKeyDer = ephemeralPublicKeyObj.export({
    type: 'spki',
    format: 'der',
  });
  const ephemeralPublicKeyRaw = ephemeralPublicKeyDer.slice(12);

  // 2. Compute shared secret using SPKI header prepended to recipient public key
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeralPrivateKeyObj,
    publicKey: crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from([
          0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21,
          0x00,
        ]),
        recipientPublicKey,
      ]),
      format: 'der',
      type: 'spki',
    }),
  });

  // 3. Derive symmetric key using HKDF-SHA256
  const salt = Buffer.from('kokono-salt-v1', 'utf8');
  const info = Buffer.from('kokono-info-v1', 'utf8');
  const derivedKey = crypto.hkdfSync('sha256', sharedSecret, salt, info, 32);

  // 4. Generate random 12-byte IV
  const iv = crypto.randomBytes(12);

  // 5. Encrypt message using AES-256-GCM
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(derivedKey),
    iv,
  );
  let ciphertext = cipher.update(message, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    key: ephemeralPublicKeyRaw.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}
