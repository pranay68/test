import { createHmac, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const product = 'clickassist';
export const plan = 'lifetime';
export const tokenTtlSeconds = Number(process.env.LICENSE_TOKEN_TTL_SECONDS || 7 * 24 * 60 * 60);

export function requireLicenseConfig(response) {
  const privateKeyPem = normalizePem(process.env.LICENSE_PRIVATE_KEY_PEM || '');
  if (!privateKeyPem) {
    response.status(501).json({ error: 'license_signing_not_configured' });
    return null;
  }
  return { privateKeyPem };
}

export async function loadLicense(keyHash) {
  const store = storeConfig();
  if (store.kind === 'upstash') {
    const value = await upstashCommand(store, ['GET', licenseRedisKey(keyHash)]);
    return value ? JSON.parse(value) : null;
  }

  if (!store.allowEnvFallback) {
    throw new Error('persistent_license_store_not_configured');
  }

  const allowedLicenses = parseJsonArray(process.env.LICENSE_KEYS_JSON || '[]');
  return allowedLicenses.find((item) => item.keyHash === keyHash) || null;
}

export async function saveLicense(license) {
  const store = storeConfig();
  if (store.kind === 'upstash') {
    await upstashCommand(store, ['SET', licenseRedisKey(license.keyHash), JSON.stringify(license)]);
    return;
  }

  if (!store.allowEnvFallback) {
    throw new Error('persistent_license_store_not_configured');
  }
}

export async function createLicenseRecord({ email, keyHash, deviceLimit = 2 }) {
  const license = {
    email: email.toLowerCase(),
    keyHash,
    status: 'active',
    product,
    plan,
    deviceLimit,
    createdAt: new Date().toISOString(),
    activations: [],
  };
  await saveLicense(license);
  return license;
}

export function validateLicenseRecord(license, { email, deviceHash }) {
  if (!license || license.status === 'revoked') return { ok: false, status: 403, error: 'license_not_found' };
  if (license.product && license.product !== product) return { ok: false, status: 403, error: 'wrong_product' };
  if (license.plan && license.plan !== plan) return { ok: false, status: 403, error: 'wrong_plan' };
  if (license.email && license.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, status: 403, error: 'email_does_not_match_license' };
  }
  if (Array.isArray(license.allowedDeviceHashes) && license.allowedDeviceHashes.length > 0) {
    if (!license.allowedDeviceHashes.includes(deviceHash)) {
      return { ok: false, status: 403, error: 'device_not_allowed' };
    }
  }
  return { ok: true };
}

export async function registerActivation(license, deviceHash) {
  const activations = Array.isArray(license.activations) ? license.activations : [];
  const existing = activations.find((activation) => activation.deviceHash === deviceHash);
  const now = new Date().toISOString();

  if (existing) {
    existing.lastSeenAt = now;
  } else {
    const deviceLimit = Number(license.deviceLimit || process.env.LICENSE_DEVICE_LIMIT || 2);
    if (activations.length >= deviceLimit) {
      return { ok: false, status: 403, error: 'device_limit_reached' };
    }
    activations.push({ deviceHash, activatedAt: now, lastSeenAt: now });
  }

  license.activations = activations;
  await saveLicense(license);
  return { ok: true };
}

export function signEntitlement({ privateKeyPem, license, deviceHash }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    licenseKeyHash: license.keyHash,
    email: license.email,
    plan,
    product,
    deviceHash,
    deviceLimit: Number(license.deviceLimit || process.env.LICENSE_DEVICE_LIMIT || 2),
    issuedAt: now,
    expiresAt: now + tokenTtlSeconds,
    features: ['click-engine', 'auto-launch', 'background', 'cps-test'],
  };
  const privateKey = createPrivateKey(privateKeyPem);
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(payloadPart), privateKey);
  return {
    token: `${payloadPart}.${Buffer.from(signature).toString('base64url')}`,
    payload,
  };
}

export function verifyEntitlementToken(token, privateKeyPem) {
  const [payloadPart, signaturePart] = String(token || '').split('.');
  if (!payloadPart || !signaturePart) throw new Error('malformed_token');

  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  const ok = verify(null, Buffer.from(payloadPart), publicKey, Buffer.from(signaturePart, 'base64url'));
  if (!ok) throw new Error('invalid_token_signature');

  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  if (payload.product !== product || payload.plan !== plan) throw new Error('wrong_token_product_or_plan');
  return payload;
}

export function hashKey(key) {
  return createHmac('sha256', 'clickassist-license-key-v1').update(String(key).trim().toUpperCase()).digest('base64url');
}

export function normalizePem(value) {
  return value.replace(/\\n/g, '\n').trim();
}

export function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function licenseRedisKey(keyHash) {
  return `license:${keyHash}`;
}

function storeConfig() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (url && token) return { kind: 'upstash', url, token };
  return { kind: 'env', allowEnvFallback: process.env.ALLOW_ENV_LICENSE_FALLBACK === '1' };
}

async function upstashCommand(store, command) {
  const response = await fetch(`${store.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${store.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });
  if (!response.ok) throw new Error(`upstash_error_${response.status}`);
  const [item] = await response.json();
  if (item.error) throw new Error(`upstash_error_${item.error}`);
  return item.result;
}
