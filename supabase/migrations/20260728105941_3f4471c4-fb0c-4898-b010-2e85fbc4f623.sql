ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_storage_provider_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_storage_provider_check CHECK (storage_provider IN ('r2', 'external', 'lovable_asset'));
