export default async function handler(request, response) {
  return response.status(410).json({
    error: 'clickassist_offline',
    detail: 'ClickAssist Stripe webhook handling is currently disabled.',
  });
}
