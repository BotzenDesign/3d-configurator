-- ============================================================================
-- BOTZEN FORMULA MIGRATION — Run this in Supabase SQL Editor
-- ============================================================================
--
-- Botzen Pricing Formula:
--   FDM: Total = (Y × M/L × A) + W × T
--   SLA: Total = (Y × M/V × B) + W × T
--
-- Where:
--   M = spool_cost      — Total purchase price of the spool or resin bottle ($)
--   L = spool_quantity  — Total filament length on spool in meters (FDM)
--   V = spool_quantity  — Total resin volume in bottle in mL (SLA)
--   Y = material_multiplier_Y  — 2× material multiplier (global setting, default 2.0)
--   W = run_time_multiplier_W  — Fixed run time multiplier in $/hr (default 1.25)
--   T = Machine run time in hours (calculated from geometry)
--   A = Filament length used in meters (FDM, calculated from geometry)
--   B = Resin volume used in mL (SLA, calculated from geometry, 1 cm³ = 1 mL)
--
-- FDM Spool Length Calculations (1.75mm filament, formula: L = mass/(ρ × π × r²)):
--   PLA/PETG-type (1000g, ρ=1.24 g/cm³): ~335 m
--   ABS         (1000g, ρ=1.04 g/cm³): ~399 m
--   TPU         (1000g, ρ=1.21 g/cm³): ~344 m
--   PETG        (1000g, ρ=1.27 g/cm³): ~328 m
--   UM 750g PLA (750g,  ρ=1.24 g/cm³): ~251 m
--   UM 750g ABS (750g,  ρ=1.04 g/cm³): ~299 m
--   UM 750g TPU (750g,  ρ=1.21 g/cm³): ~258 m
-- SLA Resin Volume: all bottles = 1000 mL
-- ============================================================================


-- ── Step 1: Add new columns to materials table ────────────────────────────────
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS spool_cost     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spool_quantity numeric NOT NULL DEFAULT 1;

-- ── Step 2: Add Y and W to app_settings ──────────────────────────────────────
INSERT INTO public.app_settings (key, value) VALUES
  ('material_multiplier_Y', '2.5'::jsonb),   -- Y: 2.5× material multiplier (Hardened)
  ('run_time_multiplier_W', '5.0'::jsonb)   -- W: $5.00 per print-hour (Industry Standard)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── Step 3: Populate spool_cost (M) and spool_quantity (L/V) for all materials ─
-- NOTE: density_gcm3 and cost_per_gram are intentionally NOT updated here.
--   density_gcm3  — internal; used by the estimation engine for weight/filament math.
--   cost_per_gram — legacy reference; not admin-editable, not used in the Botzen formula.
-- Only Botzen-formula variables (spool_cost, spool_quantity) are admin-editable.

-- FDM materials
UPDATE public.materials SET spool_cost = 20,  spool_quantity = 335  WHERE id = 'PLA_BUDGET';
UPDATE public.materials SET spool_cost = 35,  spool_quantity = 335  WHERE id = 'PLA';
UPDATE public.materials SET spool_cost = 40,  spool_quantity = 399  WHERE id = 'ABS';
UPDATE public.materials SET spool_cost = 40,  spool_quantity = 344  WHERE id = 'TPU95A';
UPDATE public.materials SET spool_cost = 40,  spool_quantity = 344  WHERE id = 'TPU60D';
UPDATE public.materials SET spool_cost = 50,  spool_quantity = 328  WHERE id = 'PETG';
UPDATE public.materials SET spool_cost = 55,  spool_quantity = 251  WHERE id = 'UM_TOUGH_PLA';
UPDATE public.materials SET spool_cost = 55,  spool_quantity = 299  WHERE id = 'UM_ABS';
UPDATE public.materials SET spool_cost = 55,  spool_quantity = 258  WHERE id = 'UM_TPU';

-- SLA materials (all 1000 mL bottles)
UPDATE public.materials SET spool_cost = 87,  spool_quantity = 1000 WHERE id = 'RESIN_CLEAR';
UPDATE public.materials SET spool_cost = 155, spool_quantity = 1000 WHERE id = 'RESIN_TOUGH';
UPDATE public.materials SET spool_cost = 89,  spool_quantity = 1000 WHERE id = 'RESIN_WHITE';
UPDATE public.materials SET spool_cost = 89,  spool_quantity = 1000 WHERE id = 'RESIN_BLACK';
UPDATE public.materials SET spool_cost = 20,  spool_quantity = 1000 WHERE id = 'RESIN_CLEAR_BLUE';

-- ── Step 4: Verify the data ───────────────────────────────────────────────────
SELECT
  id, label, type,
  spool_cost        AS "M ($)",
  spool_quantity    AS "L (m) or V (mL)",
  ROUND(spool_cost::numeric / spool_quantity::numeric, 6) AS "M/L or M/V (unit rate)",
  colors
FROM public.materials
ORDER BY type, label;
