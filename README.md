# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cloudflare Worker runtime bindings

Asset uploads and media synchronization require these runtime bindings/secrets in Cloudflare Worker environments (production, preview, and local wrangler dev):

- `MY_ASSETS` (R2 bucket binding) → `pointstudio-assets`
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` (used only by service-role fallbacks; authenticated admin server functions now use runtime-injected Supabase context directly)
- `R2_ONLY_MODE=true` for explicit R2-only local development without Supabase writes

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
