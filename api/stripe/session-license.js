import { randomBytes } from 'node:crypto';
import { createLicenseRecord, hashKey, loadLicenseByStripeSession, revealLicenseKey } from '../license/_shared.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) return response.status(501).json({ error: 'stripe_not_configured' });

  try {
    const sessionId = String(request.query?.session_id || '').trim();
    if (!sessionId.startsWith('cs_')) return response.status(400).json({ error: 'session_id_required' });

    const session = await loadStripeSession(stripeSecretKey, sessionId);
    if (session.payment_status !== 'paid') {
      return response.status(402).json({ error: 'payment_not_complete' });
    }

    const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
    if (!email) return response.status(409).json({ error: 'checkout_email_missing' });

    let license = await loadLicenseByStripeSession(session.id);
    let licenseKey = revealLicenseKey(license);

    if (!license) {
      licenseKey = generateLicenseKey();
      license = await createLicenseRecord({
        email,
        keyHash: hashKey(licenseKey),
        licenseKey,
        deviceLimit: Number(process.env.LICENSE_DEVICE_LIMIT || 2),
        source: 'stripe-success',
        stripeSessionId: session.id,
      });
    }

    if (!licenseKey) {
      return response.status(409).json({
        error: 'license_delivery_pending',
        detail: 'License exists, but this older record does not have a delivery key. Use admin recovery.',
      });
    }

    return response.status(200).json({
      email,
      licenseKey,
      deviceLimit: license.deviceLimit,
      downloadUrl: '/downloads/ClickAssist_0.1.0_x64-setup.exe',
      msiUrl: '/downloads/ClickAssist_0.1.0_x64_en-US.msi',
    });
  } catch (error) {
    return response.status(500).json({
      error: 'session_license_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadStripeSession(stripeSecretKey, sessionId) {
  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  const body = await stripeResponse.json();
  if (!stripeResponse.ok) {
    const message = body.error?.message || 'Stripe session lookup failed.';
    throw new Error(message);
  }
  return body;
}

function generateLicenseKey() {
  return `CA-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
