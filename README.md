# Polar 3D Configurator

A proprietary 3D printing configuration and quotation application. 
This application provides a web-based interface for users to upload 3D models (STL, OBJ, 3MF), view them in an interactive 3D environment, configure materials (FDM/SLA) and colors, and receive instant dynamic pricing quotes.

## Architecture

The system consists of several components:

1. **Frontend**: A React application using Vite, Tailwind CSS, and Three.js (via React Three Fiber) for the 3D viewer.
2. **Backend Services**: Supabase Edge Functions for secure pricing calculations and database management for materials, colors, and admin configuration.
3. **Shopify App Integration**: The `shopify-app/` directory contains an embedded Shopify application (Remix/Node) that integrates the configurator directly into a Shopify storefront.

## Key Features

- **Interactive 3D Viewer**: Upload and view STL, OBJ, and 3MF models directly in the browser.
- **Dynamic Pricing Engine**: Calculates model volume, surface area, and estimates weight to generate accurate pricing for FDM and SLA printing processes.
- **Shopify Integration**: Easily embed the configurator into Shopify pages, attach configured prints to the cart, and generate orders.
- **Admin Dashboard**: Manage material pricing, available colors, bulk discounts, and system configuration directly via Supabase.

## License

**PROPRIETARY AND CONFIDENTIAL**

All rights reserved. This repository and its contents are NOT open source. 
No permission is granted to use, copy, modify, distribute, or sell this software. 
See the [LICENSE](./LICENSE) file for more information.
