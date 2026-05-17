-- Create the shopify_sessions table to store OAuth tokens securely
CREATE TABLE IF NOT EXISTS public.shopify_sessions (
  id text PRIMARY KEY,
  shop text NOT NULL,
  state text NOT NULL,
  "isOnline" boolean DEFAULT false,
  scope text,
  expires timestamp with time zone,
  "accessToken" text NOT NULL,
  "userId" text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure RLS is enabled but bypassable by the service_role key
ALTER TABLE public.shopify_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies needed! The Shopify App backend uses the SERVICE_ROLE_KEY
-- which inherently bypasses RLS. 

-- Create an index for faster lookups by shop domain
CREATE INDEX IF NOT EXISTS shopify_sessions_shop_idx ON public.shopify_sessions (shop);
