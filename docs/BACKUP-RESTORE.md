# Backup & restore

Production data lives **only** in Cloudflare. Never commit database contents or
media files to GitHub.

Set these once per shell for every command below:

```sh
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...           # D1 read/write + R2 permissions
export CLOUDFLARE_D1_DATABASE_ID=ea776cce-0d0d-4583-a260-f95d3d1709c0
```

## D1 — backup

```sh
npm run db:backup -- ./backups/pointstudio-$(date +%F).sql
```

This calls the D1 export API and downloads a full SQL dump (schema + rows).
Store it outside the repository (encrypted drive, private bucket, password
manager vault). Recommended cadence: weekly, plus before any migration.

Cloudflare also keeps automatic Time Travel snapshots of D1 for the last 30
days (Dashboard → D1 → pointstudio-db → Time Travel) — useful for
point-in-time restores without a manual dump.

## D1 — restore

Into the existing database (overwrites matching rows):

```sh
npm run db:restore -- ./backups/pointstudio-2026-01-01.sql
```

Into a brand-new database (full disaster recovery):

```sh
# 1. Create the database in the Cloudflare dashboard (or via API), note its ID
export CLOUDFLARE_D1_DATABASE_ID=<new-id>
# 2. Create the schema
npm run db:migrate
# 3. Load the dump
npm run db:restore -- ./backups/pointstudio-2026-01-01.sql
# 4. Update the database_id in vite.config.ts and redeploy
```

## R2 — backup

The bucket `pointstudio-assets` holds `originals/` (untouched uploads) and
`optimized/` (WebP derivatives served to visitors). Mirror it with rclone or
the AWS CLI against the S3-compatible endpoint:

```sh
aws s3 sync s3://pointstudio-assets ./backups/r2 \
  --endpoint-url "$R2_ENDPOINT"
```

Objects are immutable once uploaded (new uploads get new keys), so an
incremental sync is enough. Keep at least one offsite copy.

## R2 — restore

```sh
aws s3 sync ./backups/r2 s3://pointstudio-assets \
  --endpoint-url "$R2_ENDPOINT"
```

Then confirm the public domain `https://images.pointstudio.ro` is still mapped
to the bucket (R2 → Settings → Public access → Custom domain). Media URLs in D1
are absolute against that domain, so keeping the domain identical means no data
migration is required.

## Full rebuild checklist

1. Clone the GitHub repository.
2. Create D1 `pointstudio-db`, run `npm run db:migrate`, restore the dump.
3. Create R2 `pointstudio-assets`, restore the objects, re-attach
   `images.pointstudio.ro`.
4. Create the Worker via Workers Builds pointing at the repository.
5. Add the secrets from `docs/INFRASTRUCTURE.md` and confirm the `DB` and
   `MY_ASSETS` bindings.
6. Deploy, then sign in at `/auth` (register the first admin if the
   `admin_users` table is empty).
