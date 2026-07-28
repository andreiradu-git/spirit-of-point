# D1 setup and migration

This project uses Cloudflare D1 as the metadata repository for media assets, galleries, and related tables. You already created a D1 database named `pointstudio` — next bind it to your Worker and the code will auto-create the schema.

Quick steps

1. Add D1 binding to your Worker

- Cloudflare dashboard:
  - Workers → your Worker (spirit-of-point) → Settings → Variables & Bindings → Add Binding → D1 Database
  - Choose `pointstudio` and set Variable name to `POINT_D1` (exactly).

- Or via wrangler.toml:

```toml
[[d1_databases]]
binding = "POINT_D1"
database_name = "pointstudio"
```

2. Ensure R2 binding exists

- The code expects an R2 binding named `MY_ASSETS` (you already have this bound to the bucket `pointstudio-assets`).

3. Environment variables

- For initial admin access and testing, set:

```
ADMIN_BYPASS_KEY=some-strong-secret
R2_ONLY_MODE=true     # optional for dev-only mode
```

4. Automatic schema creation

- The D1 adapter will automatically attempt to create the required tables the first time the Worker runs and sees the `POINT_D1` binding.
- If you prefer to run migrations manually, you can copy the SQL from `migrations/001_create_schema.sql` into the D1 Console (D1 → pointstudio → Console) and execute it.

5. Testing

- Start your Worker (wrangler dev or deploy) and verify logs. The adapter logs a message like `[d1] schema ensured for POINT_D1` when the schema is created.
- Upload an image via admin UI (include `Authorization: Bearer <ADMIN_BYPASS_KEY>` if admin endpoints expect it). Verify object appears in R2 and metadata rows appear in D1 (D1 Console → Explore Data).

6. Migration from Supabase (optional)

- If you want existing Supabase metadata copied to D1, export your Supabase tables (CSV or SQL dump) and I can provide import SQL or a small script to load them into D1.

If you want, I can now finish wiring the remaining server functions to use D1-backed metadata (media_assets, galleries, gallery_images, asset_meta, contact_messages) and open a PR. Reply "Finish D1 cutover" and I will push the remaining code and PR with tests and instructions.
