import { createHmac, generateKeyPairSync, randomBytes } from 'node:crypto';

const email = (process.argv[2] || 'friend@clickassist.local').trim().toLowerCase();

const key = generateLicenseKey();
const keyHash = hashKey(key);
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicJwk = publicKey.export({ format: 'jwk' });

console.log(JSON.stringify({
  email,
  licenseKey: key,
  licenseRecord: {
    email,
    keyHash,
    status: 'active',
    deviceLimit: 2
  },
  licenseKeysJson: JSON.stringify([{ email, keyHash, status: 'active', deviceLimit: 2 }]),
  licensePrivateKeyPemEnv: privateKeyPem.replace(/\n/g, '\\n'),
  appPublicKeyBase64Url: publicJwk.x
}, null, 2));

function generateLicenseKey() {
  return `CA-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function hashKey(key) {
  return createHmac('sha256', 'clickassist-license-key-v1').update(key.trim().toUpperCase()).digest('base64url');
}
