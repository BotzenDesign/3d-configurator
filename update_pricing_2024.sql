-- ============================================================================
-- UPDATE PRICING DEFAULTS (2024 Hardening)
-- Run this in the Supabase SQL Editor to sync with the new Cura-logic defaults.
-- ============================================================================

-- Update Y (Material Multiplier) to 2.5
-- Update W (Machine Hourly Rate) to $5.00
INSERT INTO public.app_settings (key, value) VALUES
  ('material_multiplier_Y', '2.5'::jsonb),
  ('run_time_multiplier_W', '5.0'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify the changes
SELECT * FROM public.app_settings WHERE key IN ('material_multiplier_Y', 'run_time_multiplier_W');
