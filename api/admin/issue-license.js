import { randomBytes } from 'node:crypto';
import { createLicenseRecord, hashKey } from '../license/_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.ADMIN_SECRET || request.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return response.status(401).json({ error: 'unauthorized' });
  }

  try {
    const body = request.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const deviceLimit = Number(body.deviceLimit || process.env.LICENSE_DEVICE_LIMIT || 2);
    if (!email) return response.status(400).json({ error: 'email_required' });

    const licenseKey = generateLicenseKey();
    const license = await createLicenseRecord({
      email,
      keyHash: hashKey(licenseKey),
      deviceLimit,
    });

    return response.status(200).json({
      email,
      licenseKey,
      keyHash: license.keyHash,
      deviceLimit: license.deviceLimit,
    });
  } catch (error) {
    return response.status(500).json({
      error: 'issue_license_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function generateLicenseKey() {
  return `CA-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
