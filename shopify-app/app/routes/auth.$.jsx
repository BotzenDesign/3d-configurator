import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  await authenticate.admin(request);

  // If we get here, authentication succeeded! Redirect them into the app.
  if (shop) {
    return redirect(`/app?shop=${shop}`);
  }
  
  return redirect("/app");
};
