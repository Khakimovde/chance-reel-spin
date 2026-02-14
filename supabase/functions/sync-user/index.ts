import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId, firstName, lastName, username, photoUrl } = await req.json();

    if (!telegramId) {
      return new Response(JSON.stringify({ error: "Missing telegramId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple single query - upsert with returning
    const { data: user, error } = await supabase
      .from("users")
      .upsert(
        {
          telegram_id: telegramId,
          first_name: firstName || "",
          last_name: lastName || "",
          username: username || "",
          photo_url: photoUrl || "",
        },
        { onConflict: "telegram_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error || !user) {
      // Fallback: just fetch
      const { data: existing } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ user: existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to sync" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC-USER] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
