import {
  hashKey,
  loadLicense,
  registerActivation,
  requireLicenseConfig,
  signEntitlement,
  validateLicenseRecord,
} from './_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const config = requireLicenseConfig(response);
  if (!config) return;

  try {
    const body = request.body || {};
    const licenseKey = String(body.licenseKey || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const deviceHash = String(body.deviceHash || '').trim();

    if (!licenseKey || !email || !deviceHash) {
      return response.status(400).json({ error: 'missing_license_email_or_device' });
    }

    const license = await loadLicense(hashKey(licenseKey));
    const validation = validateLicenseRecord(license, { email, deviceHash });
    if (!validation.ok) return response.status(validation.status).json({ error: validation.error });

    const activation = await registerActivation(license, deviceHash);
    if (!activation.ok) return response.status(activation.status).json({ error: activation.error });

    return response.status(200).json(signEntitlement({ ...config, license, deviceHash }));
  } catch (error) {
    return response.status(500).json({
      error: 'license_activation_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
