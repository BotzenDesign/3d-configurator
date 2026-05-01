-- 1. Create App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- 2. Create Colors Table
CREATE TABLE IF NOT EXISTS public.colors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  hex_code text NOT NULL
);

-- 3. Create Materials Table
CREATE TABLE IF NOT EXISTS public.materials (
  id text PRIMARY KEY,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('FDM', 'SLA')),
  density_gcm3 numeric NOT NULL,
  cost_per_gram numeric NOT NULL,
  price_label text NOT NULL,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Public can read all
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public read access to colors" ON public.colors FOR SELECT USING (true);
CREATE POLICY "Allow public read access to materials" ON public.materials FOR SELECT USING (true);

-- Authenticated users can modify (assuming anyone logged in is an admin for this app)
CREATE POLICY "Allow authenticated full access to app_settings" ON public.app_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to colors" ON public.colors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to materials" ON public.materials FOR ALL USING (auth.role() = 'authenticated');


-- 6. Seed App Settings Data
INSERT INTO public.app_settings (key, value) VALUES
  ('markup_multiplier', '1.0'::jsonb),
  ('base_setup_fee', '0.0'::jsonb),
  ('max_file_size_mb', '100'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 7. Seed Colors Data
INSERT INTO public.colors (name, hex_code) VALUES
  ('Red', '#e53935'),
  ('Green', '#43a047'),
  ('Blue', '#1e88e5'),
  ('Orange', '#fb8c00'),
  ('Gray', '#9e9e9e'),
  ('Silver', '#e0e0e0'),
  ('Black', '#222222'),
  ('White', '#ffffff'),
  ('Purple', '#8e24aa'),
  ('Grey', '#9e9e9e'),
  ('Yellow', '#fdd835'),
  ('Clear', '#e0f7fa'),
  ('Light Blue Clear', '#81d4fa')
ON CONFLICT (name) DO UPDATE SET hex_code = EXCLUDED.hex_code;

-- 8. Seed Materials Data
INSERT INTO public.materials (id, label, type, density_gcm3, cost_per_gram, price_label, colors) VALUES
  -- FDM
  ('PLA_BUDGET', 'PLA Budget', 'FDM', 1.24, 0.020, '$20/kg', '["Red"]'),
  ('PLA', 'PLA Standard', 'FDM', 1.24, 0.035, '$35/kg', '["Green", "Red", "Blue", "Orange", "Gray", "Silver"]'),
  ('ABS', 'ABS', 'FDM', 1.04, 0.040, '$40/kg', '["Black", "White"]'),
  ('TPU95A', 'TPU 95A (Flexible)', 'FDM', 1.21, 0.040, '$40/kg', '["Red"]'),
  ('TPU60D', 'TPU 60D (Soft)', 'FDM', 1.21, 0.040, '$40/kg', '["White"]'),
  ('PETG', 'PETG', 'FDM', 1.27, 0.050, '$50/kg', '["Green", "Purple", "Blue"]'),
  ('UM_TOUGH_PLA', 'Ultimaker Tough PLA', 'FDM', 1.24, 0.0733, '$55/750g', '["Black", "White", "Grey", "Yellow", "Blue"]'),
  ('UM_ABS', 'Ultimaker ABS', 'FDM', 1.04, 0.0733, '$55/750g', '["Black", "White"]'),
  ('UM_TPU', 'Ultimaker TPU', 'FDM', 1.21, 0.0733, '$55/750g', '["Red", "Blue", "White"]'),
  
  -- SLA
  ('RESIN_CLEAR', 'Clear v5', 'SLA', 1.10, 0.087, '$87/L', '["Clear"]'),
  ('RESIN_TOUGH', 'Tough 2000 ABS', 'SLA', 1.10, 0.155, '$155/L', '["Grey"]'),
  ('RESIN_WHITE', 'White', 'SLA', 1.10, 0.089, '$89/L', '["White"]'),
  ('RESIN_BLACK', 'Black', 'SLA', 1.10, 0.089, '$89/L', '["Black"]'),
  ('RESIN_CLEAR_BLUE', 'ClearLight Blue ABS', 'SLA', 1.10, 0.020, '$20/L', '["Light Blue Clear"]')
ON CONFLICT (id) DO UPDATE SET 
  label = EXCLUDED.label, type = EXCLUDED.type, density_gcm3 = EXCLUDED.density_gcm3, 
  cost_per_gram = EXCLUDED.cost_per_gram, price_label = EXCLUDED.price_label, colors = EXCLUDED.colors;
