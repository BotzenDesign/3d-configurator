-- ============================================================================
-- setup_admin.sql — Full schema + seed data for the 3D Configurator
-- ============================================================================
-- Run this once in the Supabase SQL Editor to bootstrap the database.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
--
-- Botzen Formula implemented:
--   FDM: Total = (Y × M/L × A) + W × T
--   SLA: Total = (Y × M/V × B) + W × T
-- ============================================================================


-- ── 1. Create App Settings Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text
);

-- ── 2. Create Materials Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.materials (
  id              text PRIMARY KEY,
  label           text    NOT NULL,
  type            text    NOT NULL CHECK (type IN ('FDM', 'SLA')),
  -- Internal values — set at seed time, NOT editable via the Admin UI:
  density_gcm3    numeric NOT NULL DEFAULT 1.24, -- used by estimation engine for weight/filament calc
  cost_per_gram   numeric NOT NULL DEFAULT 0,    -- legacy reference; kept for fallback display
  price_label     text    NOT NULL DEFAULT '',
  colors          jsonb   NOT NULL DEFAULT '[]'::jsonb,
  is_active       boolean DEFAULT true,
  -- Botzen Formula variables (Admin-editable):
  spool_cost      numeric NOT NULL DEFAULT 0,   -- M: purchase price of spool/bottle ($)
  spool_quantity  numeric NOT NULL DEFAULT 1    -- L (FDM meters) / V (SLA mL)
);

-- ── 3. Enable Row Level Security (RLS) ───────────────────────────────────────
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials    ENABLE ROW LEVEL SECURITY;

-- Add description column to app_settings if it doesn't exist yet
-- (handles databases created before this column was added)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS description text;

-- Add Botzen Formula columns to materials if they don't exist yet
-- (handles databases created from the original setup_admin.sql)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS spool_cost     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spool_quantity numeric NOT NULL DEFAULT 1;

-- ── 4. RLS Policies ──────────────────────────────────────────────────────────
-- Public can read all (needed for the configurator and quote engine)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Allow public read access to app_settings') THEN
    CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='materials' AND policyname='Allow public read access to materials') THEN
    CREATE POLICY "Allow public read access to materials" ON public.materials FOR SELECT USING (true);
  END IF;
  -- Authenticated users (admin) can modify
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Allow authenticated full access to app_settings') THEN
    CREATE POLICY "Allow authenticated full access to app_settings" ON public.app_settings FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='materials' AND policyname='Allow authenticated full access to materials') THEN
    CREATE POLICY "Allow authenticated full access to materials" ON public.materials FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ── 5. Seed Global Pricing Settings (Botzen Formula globals) ─────────────────
--   Y = material_multiplier_Y  →  default 2.0  (2× the raw material cost)
--   W = run_time_multiplier_W  →  default 1.25 ($1.25 per print-hour)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('material_multiplier_Y', '2.0'::jsonb,   'Y — Material cost multiplier. 2× means price = 2 × (M/L × A). Configurable per client.'),
  ('run_time_multiplier_W', '1.25'::jsonb,  'W — Fixed run-time multiplier in $/hr. Charged per hour of machine print time.'),
  ('max_file_size_mb',      '100'::jsonb,   'Maximum upload file size in megabytes.'),
  ('supports_enabled',      'true'::jsonb,  'Globally enable support generation calculations.'),
  ('support_density',       '0.15'::jsonb,  'Fraction of support volume to solid volume (e.g. 0.15 = 15%).'),
  ('raft_enabled',          'false'::jsonb, 'Globally enable raft calculation for FDM parts.'),
  ('raft_layers',           '3'::jsonb,     'Number of layers to generate for the raft.'),
  ('layer_height_fdm',      '0.2'::jsonb,   'Default FDM layer height in mm.')
ON CONFLICT (key) DO UPDATE SET
  value       = EXCLUDED.value,
  description = EXCLUDED.description;

-- ── 6. Seed Materials Data ────────────────────────────────────────────────────
-- Source: Client Pricing Sheet (authoritative)
--
-- Botzen variables per material:
--   spool_cost (M)  = total purchase price of spool or bottle
--   spool_quantity  = L in meters (FDM) or V in mL (SLA)
--
-- FDM Spool length derivation (1.75mm filament, ρ × π × r²):
--   1kg PLA/PETG-type  (ρ=1.24): ~335m  | 750g Ultimaker PLA: ~251m
--   1kg ABS            (ρ=1.04): ~399m  | 750g Ultimaker ABS: ~299m
--   1kg TPU            (ρ=1.21): ~344m  | 750g Ultimaker TPU: ~258m
-- SLA bottles: all 1000 mL
INSERT INTO public.materials
  (id, label, type, density_gcm3, cost_per_gram, price_label, colors, is_active, spool_cost, spool_quantity)
VALUES
  -- ── FDM ─────────────────────────────────────────────────────────────────────
  ('PLA_BUDGET',   'PLA Budget',          'FDM', 1.24, 0.0200, '$20/1000g spool',  '["Red"]',                                      true,  20,  335),
  ('PLA',          'PLA',                 'FDM', 1.24, 0.0350, '$35/1000g spool',  '["Green","Red","Blue","Orange","Gray","Silver"]', true,  35,  335),
  ('ABS',          'ABS',                 'FDM', 1.04, 0.0400, '$40/1000g spool',  '["Black","White"]',                             true,  40,  399),
  ('TPU95A',       'TPU95A',              'FDM', 1.21, 0.0400, '$40/1000g spool',  '["Red"]',                                       true,  40,  344),
  ('TPU60D',       'TPU60D',              'FDM', 1.21, 0.0400, '$40/1000g spool',  '["White"]',                                     true,  40,  344),
  ('PETG',         'PETG',                'FDM', 1.27, 0.0500, '$50/1000g spool',  '["Green","Purple","Blue"]',                     true,  50,  328),
  ('UM_TOUGH_PLA', 'Ultimaker Tough PLA', 'FDM', 1.24, 0.0733, '$55/750g spool',   '["Black","White","Grey","Yellow","Blue"]',      true,  55,  251),
  ('UM_ABS',       'Ultimaker ABS',       'FDM', 1.04, 0.0733, '$55/750g spool',   '["Black","White"]',                            true,  55,  299),
  ('UM_TPU',       'Ultimaker TPU',       'FDM', 1.21, 0.0733, '$55/750g spool',   '["Red","Blue","White"]',                       true,  55,  258),

  -- ── SLA (1000 mL bottles) ────────────────────────────────────────────────────
  ('RESIN_CLEAR',      'Clear v5',            'SLA', 1.10, 0.0870, '$87/1000mL',   '["Clear"]',            true,  87,  1000),
  ('RESIN_TOUGH',      'Tough 2000 ABS',      'SLA', 1.10, 0.1550, '$155/1000mL',  '["Grey"]',             true,  155, 1000),
  ('RESIN_WHITE',      'White',               'SLA', 1.10, 0.0890, '$89/1000mL',   '["White"]',            true,  89,  1000),
  ('RESIN_BLACK',      'Black',               'SLA', 1.10, 0.0890, '$89/1000mL',   '["Black"]',            true,  89,  1000),
  ('RESIN_CLEAR_BLUE', 'ClearLight Blue ABS', 'SLA', 1.10, 0.0200, '$20/1000mL',   '["Light Blue Clear"]', true,  20,  1000)
ON CONFLICT (id) DO UPDATE SET
  -- Admin-editable fields only:
  label          = EXCLUDED.label,
  type           = EXCLUDED.type,
  price_label    = EXCLUDED.price_label,
  colors         = EXCLUDED.colors,
  spool_cost     = EXCLUDED.spool_cost,
  spool_quantity = EXCLUDED.spool_quantity;
  -- density_gcm3 and cost_per_gram are intentionally excluded —
  -- they are internal values not managed via the Admin UI.

-- ── 7. Verify Results ─────────────────────────────────────────────────────────
SELECT
  id, type, label,
  spool_cost      AS "M ($)",
  spool_quantity  AS "L(m)/V(mL)",
  ROUND(spool_cost / spool_quantity, 6) AS "M/L or M/V",
  is_active
FROM public.materials
ORDER BY type, label;

SELECT key, value FROM public.app_settings ORDER BY key;
