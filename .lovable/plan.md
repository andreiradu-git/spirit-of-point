# Stabilize Romanian Corporate SSR

## Goal
Ensure `/ro/work/corporate` always includes its existing Romanian CMS editorial text and FAQ in the initial HTML.

## Changes
- Add a dedicated public server read for one gallery SEO record instead of relying only on the broad client-style CMS query.
- Make the Romanian Corporate route require that exact `corporate#ro` record during SSR, with a short retry for transient database failures.
- Seed the existing gallery SEO cache with that record so the current component, design, content, and editor remain unchanged.
- Stop silently rendering an empty text block if the required record cannot be loaded.

## Verification
- Confirm type/build health.
- Publish only these loading changes.
- Request the exact live URL repeatedly as Googlebot and confirm Romanian body text and FAQ are present each time.
