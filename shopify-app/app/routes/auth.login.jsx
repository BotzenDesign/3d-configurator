import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  return await login(request);
};

export const action = async ({ request }) => {
  return await login(request);
};

export default function AuthLogin() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Authenticating...</h2>
      <p>If you are not redirected automatically, please check your app URL configuration.</p>
    </div>
  );
}
