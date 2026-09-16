export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID;

  if (!stripeSecretKey || !stripePriceId) {
    return response.status(501).json({
      error: 'stripe_not_configured',
      detail: 'Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in Vercel to enable checkout.',
    });
  }

  const requestedOrigin = String((request.body || {}).origin || '').trim();
  const origin = requestedOrigin.startsWith('http') ? requestedOrigin : request.headers.origin || `https://${request.headers.host}`;
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': stripePriceId,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/`,
    billing_address_collection: 'auto',
    customer_creation: 'always',
    allow_promotion_codes: 'true',
    'metadata[product]': 'clickassist',
    'metadata[plan]': 'lifetime',
    'metadata[source]': 'website',
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const body = await stripeResponse.json();

  if (!stripeResponse.ok) {
    return response.status(502).json({
      error: 'stripe_checkout_failed',
      detail: body.error?.message || 'Stripe checkout failed.',
    });
  }

  return response.status(200).json({ url: body.url });
}
