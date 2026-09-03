# Point Studio — Production architecture

```
GitHub (source code, schema, migrations, docs)
        ↓  Cloudflare Workers Builds
Cloudflare Worker  (SSR + API + auth)
        ↓
Cloudflare D1 (pointstudio-db)   +   Cloudflare R2 (pointstudio-assets)
```

Lovable is an optional editor that commits to GitHub. It is **not** part of the
runtime, backend, database, media or deployment chain. If Lovable disappears,
everything above keeps working.

## Components

| Layer | Service | Notes |
| --- | --- | --- |
| Code | GitHub | app code, D1 schema (`db/migrations`), scripts, docs |
| Backend/SSR | Cloudflare Workers | built from this repo (TanStack Start + Nitro Cloudflare preset) |
| Database / CMS | Cloudflare D1 `pointstudio-db` (`ea776cce-0d0d-4583-a260-f95d3d1709c0`) | binding `DB` |
| Media | Cloudflare R2 `pointstudio-assets` | binding `MY_ASSETS`, public domain `https://images.pointstudio.ro` |
| Auth | Custom email + password in D1 | PBKDF2-SHA256, HttpOnly `ps_session` cookie |
| Email | Resend | contact-form notifications only (site works without it) |

Bindings are declared in `vite.config.ts` (`nitro.cloudflare.wrangler`) and are
emitted into the generated Worker config at build time.

## Required Worker secrets / variables

| Name | Purpose |
| --- | --- |
| `SESSION_SECRET` | signs/validates admin session tokens |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL` | R2 S3 API access for upload/delete/listing |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI text / SEO / alt-text generation (optional) |
| `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL` | contact-form notification email (optional) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID` | only for local scripts (migrate/backup/restore); not needed by the Worker, which uses the `DB` binding |

## Deploying from GitHub

1. Cloudflare dashboard → Workers & Pages → **Create → Workers → Connect to Git**.
2. Repository: this repo. Build command `npm run build`, deploy from the
   generated Cloudflare output.
3. Add the secrets above under Settings → Variables and Secrets.
4. Confirm bindings: D1 `DB → pointstudio-db`, R2 `MY_ASSETS → pointstudio-assets`.
5. Every push to the production branch redeploys. No Lovable involved.

## First admin account

The database ships with no admin. Visit `/auth`, choose **Create one** and
register your email + password. Once one admin exists, signup is closed and
only sign-in is possible.

## Database migrations

Schema lives in `db/migrations/*.sql` and is applied in filename order:

```sh
export CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
       CLOUDFLARE_D1_DATABASE_ID=ea776cce-0d0d-4583-a260-f95d3d1709c0
npm run db:migrate
```

Applied files are recorded in the `_migrations` table, so re-running is safe.
Add new changes as a new numbered file — never edit an applied migration.

## Disaster recovery

See `docs/BACKUP-RESTORE.md`. A complete rebuild needs only: this repository,
a D1 export, the R2 bucket contents, and the secrets listed above.
