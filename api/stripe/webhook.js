import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createLicenseRecord, hashKey, loadLicenseByStripeSession } from '../license/_shared.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return response.status(501).json({ error: 'stripe_webhook_not_configured' });
  }

  try {
    const rawBody = await readRawBody(request);
    const signatureHeader = request.headers['stripe-signature'];
    if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
      return response.status(400).json({ error: 'invalid_stripe_signature' });
    }

    const event = JSON.parse(rawBody);
    if (event.type !== 'checkout.session.completed') {
      return response.status(200).json({ received: true, ignored: event.type });
    }

    const session = event.data?.object || {};
    if (session.payment_status !== 'paid') {
      return response.status(200).json({ received: true, ignored: 'unpaid_session' });
    }

    const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
    if (!email) return response.status(400).json({ error: 'checkout_email_missing' });

    const existing = await loadLicenseByStripeSession(session.id);
    if (existing) {
      return response.status(200).json({ received: true, alreadyIssued: true, keyHash: existing.keyHash });
    }

    const licenseKey = generateLicenseKey();
    const license = await createLicenseRecord({
      email,
      keyHash: hashKey(licenseKey),
      deviceLimit: Number(process.env.LICENSE_DEVICE_LIMIT || 2),
      source: 'stripe',
      stripeSessionId: session.id,
    });

    console.log(JSON.stringify({
      type: 'clickassist_license_issued',
      email,
      keyHash: license.keyHash,
      stripeSessionId: session.id,
      licenseKey,
    }));

    return response.status(200).json({
      received: true,
      issued: true,
      email,
      keyHash: license.keyHash,
      delivery: 'logged',
    });
  } catch (error) {
    return response.status(500).json({
      error: 'stripe_webhook_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function generateLicenseKey() {
  return `CA-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(String(signatureHeader).split(',').map((part) => part.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return timingSafeEqualHex(signature, expected);
}

function timingSafeEqualHex(a, b) {
  const aBuffer = Buffer.from(String(a), 'hex');
  const bBuffer = Buffer.from(String(b), 'hex');
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
