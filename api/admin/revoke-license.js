import { loadLicense, saveLicense } from '../license/_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.ADMIN_SECRET || request.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return response.status(401).json({ error: 'unauthorized' });
  }

  try {
    const keyHash = String((request.body || {}).keyHash || '').trim();
    if (!keyHash) return response.status(400).json({ error: 'key_hash_required' });
    const license = await loadLicense(keyHash);
    if (!license) return response.status(404).json({ error: 'license_not_found' });
    license.status = 'revoked';
    license.revokedAt = new Date().toISOString();
    await saveLicense(license);
    return response.status(200).json({ ok: true, keyHash });
  } catch (error) {
    return response.status(500).json({
      error: 'revoke_license_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
