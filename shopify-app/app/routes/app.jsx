import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu suppressHydrationWarning={true}>
        <a href="/app" rel="home" suppressHydrationWarning={true}>
          Dashboard
        </a>
        <a href="/app/settings" suppressHydrationWarning={true}>Global Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs this boundary to catch 401s and bounce the user to the re-auth flow via App Bridge
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
