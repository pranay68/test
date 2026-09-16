const fallbackVersion = '0.1.0';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const latestVersion = String(process.env.CLICKASSIST_LATEST_VERSION || fallbackVersion);
  const currentVersion = String(request.query.current_version || request.query.currentVersion || '0.0.0');
  const target = String(request.query.target || 'windows');
  const arch = String(request.query.arch || 'x86_64');
  const signature = String(process.env.CLICKASSIST_UPDATE_SIGNATURE || '').trim();
  const updateUrl = String(process.env.CLICKASSIST_UPDATE_URL || '').trim();
  const notes = String(process.env.CLICKASSIST_UPDATE_NOTES || 'ClickAssist update.');

  if (!isNewerVersion(latestVersion, currentVersion) || !signature || !updateUrl) {
    return response.status(204).end();
  }

  if (target !== 'windows' || !['x86_64', 'x64'].includes(arch)) {
    return response.status(204).end();
  }

  return response.status(200).json({
    version: latestVersion,
    pub_date: process.env.CLICKASSIST_UPDATE_PUB_DATE || new Date().toISOString(),
    url: updateUrl,
    signature,
    notes,
  });
}

function isNewerVersion(latest, current) {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return true;
    if (a[index] < b[index]) return false;
  }
  return false;
}

function parseSemver(value) {
  return String(value)
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0)
    .concat([0, 0, 0])
    .slice(0, 3);
}
