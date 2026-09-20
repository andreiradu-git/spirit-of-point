# Preserve typography in Edit Mode

## Goal
Make editable text render with the same typography, dimensions, wrapping, and spacing as View Mode on the Romanian and English Food landing pages.

## Changes
- Keep the same semantic HTML elements and public classes in both modes.
- Replace layout-changing editable wrappers with flow-neutral wrappers or matched elements.
- Remove Edit Mode padding, negative margins, extra block margins, and border-like sizing; use non-layout `outline` only.
- Position editing controls absolutely or after the content so they do not alter text measurements.
- Preserve the existing shared saved-content hooks so View and Edit modes read the same stored text/list values.

## Verification
- Compare RO and EN Food pages with Edit Mode OFF and ON at desktop and mobile widths.
- Check computed font, size, weight, line-height, width, margins, positions, and line wrapping.
- Confirm the same saved content is rendered in both modes and no SEO or public content changes.
- Check the preview build and runtime logs.
