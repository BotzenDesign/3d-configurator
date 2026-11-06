-- ============================================================================
-- Add Infill Price Multipliers to app_settings
-- ============================================================================
-- Run this in the Supabase SQL Editor if you want to initialize the default
-- multiplier values in the database.
-- (Note: The Admin Dashboard can also insert/update them automatically)
-- ============================================================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('infill_multiplier_20', '1.0'::jsonb, 'Standard (20%) Infill - Baseline price (1.0 = normal)'),
  ('infill_multiplier_40', '1.15'::jsonb, 'Medium (40%) Infill - Price multiplier (e.g. 1.15 = +15%)'),
  ('infill_multiplier_60', '1.30'::jsonb, 'Dense (60%) Infill - Price multiplier (e.g. 1.30 = +30%)'),
  ('infill_multiplier_80', '1.50'::jsonb, 'Extra Dense (80%) Infill - Price multiplier (e.g. 1.50 = +50%)'),
  ('infill_multiplier_100', '1.80'::jsonb, 'Solid (100%) Infill - Price multiplier (e.g. 1.80 = +80%)')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Verify
SELECT key, value, description FROM public.app_settings WHERE key LIKE 'infill_multiplier_%' ORDER BY key;
