# ClickAssist Launch Checklist

## Launch Position

Current target: controlled paid early access, then public launch after persistent storage, Stripe, and updater artifacts are verified.

## Required Before Paid Public Traffic

- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel.
- Disable env fallback by removing `ALLOW_ENV_LICENSE_FALLBACK` or setting it to `0`.
- Configure `ADMIN_SECRET` in Vercel.
- Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`.
- Test `/api/system/health`; it must return `ok: true`.
- Test checkout in Stripe test mode.
- Test webhook license issuance with Stripe CLI.
- Test one real activation, refresh, revoke, and device-limit rejection.
- Add email delivery for issued license keys, or manually fulfill orders from Vercel logs for early access.
- Build signed Tauri updater artifacts before enabling auto-update release env vars.
- Code sign the Windows installer before broad marketing.

## Stripe Env

```powershell
'sk_test_...' | npx vercel env add STRIPE_SECRET_KEY production --force --yes
'price_...' | npx vercel env add STRIPE_PRICE_ID production --force --yes
'whsec_...' | npx vercel env add STRIPE_WEBHOOK_SECRET production --force --yes
```

## License Store Env

```powershell
'https://...' | npx vercel env add UPSTASH_REDIS_REST_URL production --force --yes
'...' | npx vercel env add UPSTASH_REDIS_REST_TOKEN production --force --yes
'your-admin-secret' | npx vercel env add ADMIN_SECRET production --force --yes
'0' | npx vercel env add ALLOW_ENV_LICENSE_FALLBACK production --force --yes
```

## Update Env

Only set these after the Tauri build produces signed update artifacts.

```powershell
'0.1.1' | npx vercel env add CLICKASSIST_LATEST_VERSION production --force --yes
'https://clickassist.vercel.app/downloads/ClickAssist_0.1.1_x64-setup.nsis.zip' | npx vercel env add CLICKASSIST_UPDATE_URL production --force --yes
'<contents of .sig file>' | npx vercel env add CLICKASSIST_UPDATE_SIGNATURE production --force --yes
'Release notes...' | npx vercel env add CLICKASSIST_UPDATE_NOTES production --force --yes
```

## Verification Commands

```powershell
Invoke-RestMethod https://clickassist.vercel.app/api/system/health
Invoke-RestMethod https://clickassist.vercel.app/api/releases/latest
Invoke-WebRequest https://clickassist.vercel.app/downloads/ClickAssist_0.1.0_x64-setup.exe -Method Head
```
