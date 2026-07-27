export default function handler(request, response) {
  return response.status(410).json({
    error: 'clickassist_offline',
    detail: 'ClickAssist releases and downloads are currently disabled.',
  });
}
