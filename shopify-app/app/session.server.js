import { Session } from "@shopify/shopify-api";
import { supabaseAdmin } from "./supabase.server";

/**
 * Custom Shopify Session Storage adapter using Supabase REST API.
 * This satisfies the SessionStorage interface required by Shopify App Remix.
 */
export class SupabaseSessionStorage {
  /**
   * Stores a session in the `shopify_sessions` table.
   */
  async storeSession(session) {
    const { error } = await supabaseAdmin.from("shopify_sessions").upsert(
      {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires ? session.expires.toISOString() : null,
        accessToken: session.accessToken,
        userId: session.onlineAccessInfo?.associated_user?.id
          ? BigInt(session.onlineAccessInfo.associated_user.id).toString()
          : null,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("❌ [SessionStore] CRITICAL ERROR storing session:", JSON.stringify(error));
      return false;
    }
    console.log("✅ [SessionStore] Successfully stored session for:", session.shop);
    return true;
  }

  /**
   * Loads a session by ID from the `shopify_sessions` table.
   */
  async loadSession(id) {
    console.log("🔍 [SessionStore] Attempting to load session ID:", id);
    const { data, error } = await supabaseAdmin
      .from("shopify_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle(); // ✅ Returns null (not error) when 0 rows found

    if (error) {
      // This is a REAL database error (connection issue, bad query, etc.)
      console.error("❌ [SessionStore] CRITICAL DB ERROR loading session:", JSON.stringify(error));
      return undefined;
    }
    if (!data) {
      // This is NORMAL on first install — session simply doesn't exist yet
      console.log("ℹ️ [SessionStore] No session found for ID:", id, "(normal on first install)");
      return undefined;
    }
    
    console.log("✅ [SessionStore] Successfully loaded session for:", data.shop);

    const session = new Session({
      id: data.id,
      shop: data.shop,
      state: data.state,
      isOnline: data.isOnline,
      scope: data.scope,
      expires: data.expires ? new Date(data.expires) : undefined,
      accessToken: data.accessToken,
    });

    return session;
  }

  /**
   * Deletes a session by ID.
   */
  async deleteSession(id) {
    const { error } = await supabaseAdmin
      .from("shopify_sessions")
      .delete()
      .eq("id", id);
    return !error;
  }

  /**
   * Deletes multiple sessions by ID.
   */
  async deleteSessions(ids) {
    const { error } = await supabaseAdmin
      .from("shopify_sessions")
      .delete()
      .in("id", ids);
    return !error;
  }

  /**
   * Finds all sessions belonging to a specific shop.
   */
  async findSessionsByShop(shop) {
    const { data, error } = await supabaseAdmin
      .from("shopify_sessions")
      .select("*")
      .eq("shop", shop);

    if (error || !data) return [];

    return data.map(
      (row) =>
        new Session({
          id: row.id,
          shop: row.shop,
          state: row.state,
          isOnline: row.isOnline,
          scope: row.scope,
          expires: row.expires ? new Date(row.expires) : undefined,
          accessToken: row.accessToken,
        })
    );
  }
}
