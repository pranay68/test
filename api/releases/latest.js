const currentVersion = '0.1.0';
const releaseDate = '2026-07-24T00:00:00.000Z';

export default function handler(request, response) {
  const origin = request.headers['x-forwarded-proto']
    ? `${request.headers['x-forwarded-proto']}://${request.headers.host}`
    : `https://${request.headers.host}`;

  return response.status(200).json({
    product: 'clickassist',
    version: currentVersion,
    channel: 'early-access',
    pubDate: releaseDate,
    notes: [
      'Native Windows click engine with bounded CPS ranges.',
      'License activation and refresh through ClickAssist server.',
      'Game detect, background mode, CPS test, and F8 kill key.',
    ],
    downloads: {
      nsis: `${origin}/downloads/ClickAssist_0.1.0_x64-setup.exe`,
      msi: `${origin}/downloads/ClickAssist_0.1.0_x64_en-US.msi`,
    },
    updaterReady: false,
    updaterReason: 'Signed update artifacts are not published yet.',
  });
}
