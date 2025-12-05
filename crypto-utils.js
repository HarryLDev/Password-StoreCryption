const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const PBKDF2_ITER = 200000;
const KEY_LEN = 32;

function genRandomBytes(len = 16) {
  return crypto.randomBytes(len);
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, KEY_LEN, 'sha512');
}

function encryptBuffer(key, plaintext) {
  const iv = genRandomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64')
  };
}

function decryptBuffer(key, obj) {
  const iv = Buffer.from(obj.iv, 'base64');
  const tag = Buffer.from(obj.tag, 'base64');
  const ciphertext = Buffer.from(obj.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function createPasswordVerifier(password) {
  const salt = genRandomBytes(16);
  const verifier = crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, KEY_LEN, 'sha512');
  return {
    salt: salt.toString('base64'),
    verifier: verifier.toString('base64')
  };
}

function verifyPassword(password, saltB64, verifierB64) {
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(verifierB64, 'base64');
  const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, KEY_LEN, 'sha512');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

module.exports = {
  deriveKey,
  encryptBuffer,
  decryptBuffer,
  createPasswordVerifier,
  verifyPassword
};
