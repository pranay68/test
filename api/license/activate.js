import { createPrivateKey, createPublicKey, createHmac, sign } from 'node:crypto';

const product = 'clickassist';
const plan = 'lifetime';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const privateKeyPem = normalizePem(process.env.LICENSE_PRIVATE_KEY_PEM || '');
  const allowedLicenses = parseAllowedLicenses(process.env.LICENSE_KEYS_JSON || '[]');

  if (!privateKeyPem || allowedLicenses.length === 0) {
    return response.status(501).json({
      error: 'license_server_not_configured',
      detail: 'Set LICENSE_PRIVATE_KEY_PEM and LICENSE_KEYS_JSON in Vercel.',
    });
  }

  const body = request.body || {};
  const licenseKey = String(body.licenseKey || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const deviceHash = String(body.deviceHash || '').trim();

  if (!licenseKey || !email || !deviceHash) {
    return response.status(400).json({ error: 'missing_license_email_or_device' });
  }

  const keyHash = hashKey(licenseKey);
  const license = allowedLicenses.find((item) => item.keyHash === keyHash && item.status !== 'revoked');

  if (!license) {
    return response.status(403).json({ error: 'license_not_found' });
  }

  if (license.email && license.email.toLowerCase() !== email) {
    return response.status(403).json({ error: 'email_does_not_match_license' });
  }

  if (Array.isArray(license.allowedDeviceHashes) && license.allowedDeviceHashes.length > 0) {
    if (!license.allowedDeviceHashes.includes(deviceHash)) {
      return response.status(403).json({ error: 'device_not_allowed' });
    }
  }

  const deviceLimit = Number(license.deviceLimit || process.env.LICENSE_DEVICE_LIMIT || 2);
  const payload = {
    licenseKeyHash: keyHash,
    email,
    plan,
    product,
    deviceHash,
    deviceLimit,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: null,
    features: ['click-engine', 'auto-launch', 'background', 'cps-test'],
  };

  return response.status(200).json({
    token: signEntitlement(payload, privateKeyPem),
    payload,
  });
}

function signEntitlement(payload, privateKeyPem) {
  const privateKey = createPrivateKey(privateKeyPem);
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(payloadPart), privateKey);
  return `${payloadPart}.${Buffer.from(signature).toString('base64url')}`;
}

function parseAllowedLicenses(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hashKey(key) {
  return createHmac('sha256', 'clickassist-license-key-v1').update(key.trim().toUpperCase()).digest('base64url');
}

function normalizePem(value) {
  return value.replace(/\\n/g, '\n').trim();
}

export function publicKeyFromPrivateKey(privateKeyPem) {
  return createPublicKey(createPrivateKey(normalizePem(privateKeyPem))).export({ format: 'jwk' }).x;
}
