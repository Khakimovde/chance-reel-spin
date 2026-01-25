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
    
    // Get or create user
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    
    let currentUser = user;
    
    if (!currentUser) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          telegram_id: telegramId,
          first_name: firstName || "",
          last_name: lastName || "",
          username: username || "",
          photo_url: photoUrl || "",
          coins: 0,
          tickets: 1, // 1 free ticket for new users
        })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      currentUser = newUser;
    } else {
      // Update user info
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          first_name: firstName || currentUser.first_name,
          last_name: lastName || currentUser.last_name,
          username: username || currentUser.username,
          photo_url: photoUrl || currentUser.photo_url,
        })
        .eq("telegram_id", telegramId)
        .select()
        .single();
      
      if (!updateError) {
        currentUser = updatedUser;
      }
    }
    
    return new Response(JSON.stringify({ user: currentUser }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
