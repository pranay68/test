import {
  loadLicense,
  registerActivation,
  requireLicenseConfig,
  signEntitlement,
  validateLicenseRecord,
  verifyEntitlementToken,
} from './_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const config = requireLicenseConfig(response);
  if (!config) return;

  try {
    const token = String((request.body || {}).token || '').trim();
    if (!token) return response.status(400).json({ error: 'missing_token' });

    const payload = verifyEntitlementToken(token, config.privateKeyPem);
    const license = await loadLicense(payload.licenseKeyHash);
    const validation = validateLicenseRecord(license, {
      email: payload.email,
      deviceHash: payload.deviceHash,
    });
    if (!validation.ok) return response.status(validation.status).json({ error: validation.error });

    const activation = await registerActivation(license, payload.deviceHash);
    if (!activation.ok) return response.status(activation.status).json({ error: activation.error });

    return response.status(200).json(signEntitlement({ ...config, license, deviceHash: payload.deviceHash }));
  } catch (error) {
    return response.status(403).json({
      error: 'license_refresh_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
