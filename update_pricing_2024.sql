-- ============================================================================
-- UPDATE PRICING & MATERIALS (STRICT 2024 SPEC - COLOR FIX)
-- ============================================================================

-- 1. Global Settings
INSERT INTO public.app_settings (key, value) VALUES
  ('material_multiplier_Y', '2.5'::jsonb),
  ('run_time_multiplier_W', '5.0'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. FDM Materials (M = spool_cost, L = spool_quantity in meters)
-- PLA Budget ($20, 1000g -> 335m)
UPDATE public.materials SET spool_cost = 20, spool_quantity = 335, colors = '["Red"]'::jsonb WHERE id = 'PLA_BUDGET';
-- PLA Standard ($35, 1000g -> 335m)
UPDATE public.materials SET spool_cost = 35, spool_quantity = 335, colors = '["Green", "Red", "Blue", "Orange", "Gray", "Silver"]'::jsonb WHERE id = 'PLA';
-- ABS ($40, 1000g -> 399m)
UPDATE public.materials SET spool_cost = 40, spool_quantity = 399, colors = '["Black", "White"]'::jsonb WHERE id = 'ABS';
-- TPU 95A ($40, 1000g -> 344m)
UPDATE public.materials SET spool_cost = 40, spool_quantity = 344, colors = '["Red"]'::jsonb WHERE id = 'TPU95A';
-- TPU 60D ($40, 1000g -> 344m)
UPDATE public.materials SET spool_cost = 40, spool_quantity = 344, colors = '["White"]'::jsonb WHERE id = 'TPU60D';
-- PETG ($50, 1000g -> 328m)
UPDATE public.materials SET spool_cost = 50, spool_quantity = 328, colors = '["Green", "Purple", "Blue"]'::jsonb WHERE id = 'PETG';
-- Ultimaker Tough PLA ($55, 750g -> 251m)
UPDATE public.materials SET spool_cost = 55, spool_quantity = 251, colors = '["Black", "White", "Grey", "Yellow", "Blue"]'::jsonb WHERE id = 'UM_TOUGH_PLA';
-- Ultimaker ABS ($55, 750g -> 299m)
UPDATE public.materials SET spool_cost = 55, spool_quantity = 299, colors = '["Black", "White"]'::jsonb WHERE id = 'UM_ABS';
-- Ultimaker TPU ($55, 750g -> 258m)
UPDATE public.materials SET spool_cost = 55, spool_quantity = 258, colors = '["Red", "Blue", "White"]'::jsonb WHERE id = 'UM_TPU';

-- 3. SLA Materials (M = spool_cost, V = spool_quantity in mL)
-- Clear v5 ($87, 1000ml)
UPDATE public.materials SET spool_cost = 87, spool_quantity = 1000, colors = '["Clear"]'::jsonb WHERE id = 'RESIN_CLEAR';
-- Tough 2000 ABS ($155, 1000ml)
UPDATE public.materials SET spool_cost = 155, spool_quantity = 1000, colors = '["Grey"]'::jsonb WHERE id = 'RESIN_TOUGH';
-- White ($89, 1000ml)
UPDATE public.materials SET spool_cost = 89, spool_quantity = 1000, colors = '["White"]'::jsonb WHERE id = 'RESIN_WHITE';
-- Black ($89, 1000ml)
UPDATE public.materials SET spool_cost = 89, spool_quantity = 1000, colors = '["Black"]'::jsonb WHERE id = 'RESIN_BLACK';
-- ClearLight Blue ABS ($20, 1000ml)
UPDATE public.materials SET spool_cost = 20, spool_quantity = 1000, colors = '["Light Blue Clear"]'::jsonb WHERE id = 'RESIN_CLEAR_BLUE';

-- Verification
SELECT id, label, spool_cost AS "M", spool_quantity AS "L/V", colors FROM public.materials;
