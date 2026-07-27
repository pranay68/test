export default async function handler(request, response) {
  return response.status(410).json({
    error: 'clickassist_offline',
    detail: 'ClickAssist license delivery is currently disabled.',
  });
}
