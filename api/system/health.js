import { licenseStoreHealth } from '../license/_shared.js';

export default function handler(_request, response) {
  const store = licenseStoreHealth();
  return response.status(store.persistent ? 200 : 503).json({
    ok: store.persistent,
    product: 'clickassist',
    store,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    licenseSigningConfigured: Boolean(process.env.LICENSE_PRIVATE_KEY_PEM),
    tokenTtlSeconds: Number(process.env.LICENSE_TOKEN_TTL_SECONDS || 7 * 24 * 60 * 60),
  });
}
