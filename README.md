# WalletOCR Admin

Next.js + Tailwind CSS admin portal.

## Roles

This app is designed to work with your Clerk JWT custom claims:

- `OrgId`: customer/tenant id
- `Role`: `org:accountant` or `org:admin`
- `Email`: used to detect superadmin

Superadmin is configured by env var `SUPERADMIN_EMAILS` (semicolon-separated).

## Environment

Create `src/WalletOCR.Admin/.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...`
- `CLERK_SECRET_KEY=...`
- `CLERK_JWT_TEMPLATE=...` (template name that includes the custom claims above)
- `API_BASE_URL=https://localhost:xxxx` (your `WebApi` base URL)
- `SUPERADMIN_EMAILS=you@domain.com;other@domain.com`

## Run

```bash
cd src/WalletOCR.Admin
npm i
npm run dev
```
