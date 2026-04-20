# Polar 3D Configurator
## Phase 6 Go-Live Checklist

This checklist corresponds to the Deliverables outlined in `custom_implementation_plan.md` for Task 6.2 (Production Deployment).

### 1. Delivery Summary
- [x] **Deployment scripts generated:** Integrated via `vercel.json` (serverless Node + Vite React builds).
- [x] **Environment configs generated:** See `.env.example`.
- [x] **Monitoring dashboards configured:** `@vercel/analytics` integrated into the React root module (`src/App.tsx`). Vercel's out-of-the-box system metrics handles backend CPU/RAM telemetry automatically.

### 2. Pre-Deployment (Local Check)
- [ ] You have installed Vercel CLI locally (`npm i -g vercel`).
- [ ] You have successfully tested uploading a 3D model and clicking "Proceed to Checkout".

### 3. Deployment Execution (Vercel)
- [ ] Run `npx vercel` in your terminal.
- [ ] Follow the prompts (e.g., *Set up and deploy? [Y/n]*, *Link to existing project? [N]*).
- [ ] Do **NOT** override the default build commands (leave them as default so Vercel uses the `vercel.json` instructions).
- [ ] Once deployed, Vercel gives you a Production URL (e.g. `https://polar-3d-conf.vercel.app`).

### 4. Post-Deployment (Environment Sync)
- [ ] Open your Vercel Dashboard (https://vercel.com/dashboard)
- [ ] Navigate to **Settings > Environment Variables**.
- [ ] Add the variables from `.env.example`:
  - `VITE_SHOPIFY_DOMAIN`
  - `SHOPIFY_ADMIN_TOKEN`
  - `SHOPIFY_API_SECRET`
- [ ] Trigger a Redeploy in Vercel so the backend lambda picks up the new environment variables.

### 5. Shopify App Proxy Setup (Final Step)
- [ ] Log into the Shopify Partner Dashboard.
- [ ] Go to your Custom App Settings > App Proxy.
- [ ] Set "Proxy URL" to: `[YOUR_VERCEL_URL]/api/proxy`
- [ ] Set "Subpath prefix" and "Subpath" to: `apps` and `3d-configurator`
- [ ] Go to your Shopify Store dashboard and verify that `your-store.myshopify.com/apps/3d-configurator` correctly loads your React app without errors!
