import { licenseStoreHealth, listLicenses } from '../license/_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.ADMIN_SECRET || request.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return response.status(401).json({ error: 'unauthorized' });
  }

  try {
    const licenses = await listLicenses();
    return response.status(200).json({
      store: licenseStoreHealth(),
      licenses: licenses.map((license) => ({
        email: license.email,
        keyHash: license.keyHash,
        status: license.status || 'active',
        source: license.source || 'unknown',
        deviceLimit: Number(license.deviceLimit || process.env.LICENSE_DEVICE_LIMIT || 2),
        activations: Array.isArray(license.activations) ? license.activations : [],
        createdAt: license.createdAt || null,
        revokedAt: license.revokedAt || null,
        stripeSessionId: license.stripeSessionId || null,
      })),
    });
  } catch (error) {
    return response.status(500).json({
      error: 'list_licenses_failed',
      detail: error instanceof Error ? error.message : String(error),
      store: licenseStoreHealth(),
    });
  }
}
