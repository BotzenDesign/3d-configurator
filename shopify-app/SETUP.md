# Polar 3D Configurator — Shopify App

This repository contains the refactored Polar 3D Configurator, now structured as a **Shopify App** with an embedded Polaris Admin Dashboard and a drag-and-drop Theme App Extension.

## 1. Prerequisites

- **Node.js**: v18.20.0 or higher
- **Package Manager**: `npm` (or `bun` / `yarn`)
- **Shopify Partner Account**: To create the app and install it on development stores.
- **Supabase Account**: Your existing Supabase database housing `materials` and `app_settings`.

## 2. Setup Instructions

### Step 2.1: Install Dependencies
Open your terminal in the `shopify-app/` directory and run:
```bash
npm install
```

### Step 2.2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the following variables:
- `SHOPIFY_API_KEY`: Your **Client ID** from the Shopify Partner Dashboard.
- `SHOPIFY_API_SECRET`: Your **Client secret** from the Shopify Partner Dashboard.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: From your Supabase Project Settings.

### Step 2.3: Initialize the Database (Session Store)
The app uses a Custom Supabase Adapter to store Shopify OAuth sessions securely in your Supabase database.
1. Open the SQL Editor in your Supabase Dashboard.
2. Open the file `setup_shopify_sessions.sql` included in this folder.
3. Run the SQL script to create the `shopify_sessions` table.

### Step 2.4: Build the Storefront Widget
The 3D configurator React app needs to be compiled into a single asset for the Theme App Extension.
```bash
npm run widget:build
```
*This command bundles the React code into `extensions/3d-configurator/assets/configurator.js` and `configurator.css`.*

### Step 2.5: Start Development Server
Run the Shopify App CLI to start the tunnel and serve the app:
```bash
npm run dev
```
Follow the prompts in the terminal to connect this code to your Shopify Partner App and install it on your development store.

## 3. How to Use

### Admin Dashboard
Once installed, open the App in your Shopify Admin. You will see the **Polaris UI** dashboard where you can:
- Add/Edit FDM and SLA materials.
- Set base spool costs and quantities.
- Adjust global pricing multipliers and configuration settings (e.g., `material_multiplier_Y`).

*Note: All data saved here syncs directly to your Supabase `materials` and `app_settings` tables via server-side API calls.*

### Storefront Widget
1. Go to your Shopify Admin → **Online Store** → **Themes** → **Customize**.
2. Navigate to a Product page.
3. Click **Add Section** (or Add Block) and select **3D Configurator**.
4. Configure the block settings on the right panel:
   - Enter your `Supabase Project URL` and `Anon Key` so the widget can fetch pricing data.
   - Pick your brand's accent color.
5. Save the theme. Customers can now upload 3D models and get instant quotes.

## 4. Production Deployment on Railway

Follow these steps to deploy the Shopify app backend to Railway:

### Step 4.1: Prepare your Railway Project
1. Log in to your **[Railway Dashboard](https://railway.app)**.
2. Click **+ New Project** → **Deploy from GitHub repo**.
3. Choose the `3d-configurator` repository.
4. Set the **Root Directory** settings under the Service config to: `/shopify-app` (since the Shopify app server lives in the `shopify-app` subdirectory).

### Step 4.2: Configure Railway Environment Variables
Add the following variables under the **Variables** tab in your Railway service:
- `SHOPIFY_API_KEY`: Your Client ID from the Shopify Partner Dashboard.
- `SHOPIFY_API_SECRET`: Your Client Secret.
- `APP_URL`: Your public Railway URL (e.g., `https://your-app.up.railway.app`). **Do not use a `.railway.internal` URL.**
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_ANON_KEY`: Your Supabase Anon/Public Key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (used securely on the server-side to bypass RLS).
- `SCOPES`: `write_draft_orders,read_orders,read_customers`
- `NODE_ENV`: `production`

### Step 4.3: Update and Push App URL Configuration
1. Open the file `shopify.app.production.toml` in your editor.
2. Replace all instances of `https://YOUR-RAILWAY-APP-NAME.up.railway.app` with your actual public Railway app URL.
3. In your terminal, run the following commands to set and push this production configuration to Shopify's servers:
   ```bash
   npx shopify app config use shopify.app.production.toml
   npx shopify app config push
   ```

### Step 4.4: Deploy Extensions
Run the deploy command via Shopify CLI to push your Theme App Extension (the storefront widget iframe loader) to Shopify's CDN:
```bash
npx shopify app deploy
```


## 5. Security Notes
- The Shopify Admin API token is **never** sent to the frontend.
- The Draft Order checkout logic is securely handled by the `/api/checkout` remix proxy.
- The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in the Remix app to bypass RLS for the Admin Dashboard.
