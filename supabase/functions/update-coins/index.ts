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
    const { telegramId, amount, source, updateStats } = await req.json();
    
    if (!telegramId || amount === undefined) {
      return new Response(JSON.stringify({ error: "Missing telegramId or amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const newCoins = Math.max(0, user.coins + amount);
    const newTotalWinnings = source === 'lottery' ? user.total_winnings + amount : user.total_winnings;
    
    // Update user coins
    const { error: updateError } = await supabase
      .from("users")
      .update({ 
        coins: newCoins,
        total_winnings: newTotalWinnings,
      })
      .eq("id", user.id);
    
    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update coins" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Update daily stats if needed
    if (updateStats) {
      const today = new Date().toISOString().split('T')[0];
      
      // Try to insert or update daily stats
      const { data: existingStats } = await supabase
        .from("daily_stats")
        .select("*")
        .eq("date", today)
        .maybeSingle();
      
      if (existingStats) {
        const updateField: Record<string, number> = {};
        if (updateStats === 'ads') updateField.ads_watched = existingStats.ads_watched + 1;
        if (updateStats === 'wheel') updateField.wheel_spins = existingStats.wheel_spins + 1;
        if (updateStats === 'games') updateField.games_played = existingStats.games_played + 1;
        
        await supabase
          .from("daily_stats")
          .update(updateField)
          .eq("id", existingStats.id);
      } else {
        const newStats: Record<string, number | string> = { date: today };
        if (updateStats === 'ads') newStats.ads_watched = 1;
        if (updateStats === 'wheel') newStats.wheel_spins = 1;
        if (updateStats === 'games') newStats.games_played = 1;
        
        await supabase
          .from("daily_stats")
          .insert(newStats);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      newCoins,
      newTotalWinnings,
    }), {
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
