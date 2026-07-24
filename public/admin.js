const form = document.querySelector('[data-admin-form]');
const refreshButton = document.querySelector('[data-refresh-admin]');
const revokeButton = document.querySelector('[data-revoke]');
const revokeHash = document.querySelector('[data-revoke-hash]');
const output = document.querySelector('[data-admin-output]');
const healthOutput = document.querySelector('[data-health-output]');

let adminSecret = '';

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  adminSecret = String(data.get('secret') || adminSecret || '').trim();
  const email = String(data.get('email') || '').trim();
  const deviceLimit = Number(data.get('deviceLimit') || 2);

  const result = await adminFetch('/api/admin/issue-license', {
    method: 'POST',
    body: JSON.stringify({ email, deviceLimit }),
  });
  write(output, result);
});

refreshButton?.addEventListener('click', async () => {
  const health = await fetch('/api/system/health').then((response) => response.json());
  write(healthOutput, health);

  adminSecret ||= String(form?.elements.secret?.value || '').trim();
  if (adminSecret) {
    const licenses = await adminFetch('/api/admin/list-licenses');
    write(output, licenses);
  }
});

revokeButton?.addEventListener('click', async () => {
  adminSecret ||= String(form?.elements.secret?.value || '').trim();
  const keyHash = String(revokeHash?.value || '').trim();
  const result = await adminFetch('/api/admin/revoke-license', {
    method: 'POST',
    body: JSON.stringify({ keyHash }),
  });
  write(output, result);
});

async function adminFetch(path, init = {}) {
  if (!adminSecret) return { error: 'admin_secret_required' };

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSecret}`,
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, ...body };
}

function write(node, value) {
  if (!node) return;
  node.textContent = JSON.stringify(value, null, 2);
}
