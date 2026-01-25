import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Calculate reward based on matches: 0=10, 1=20, 2=30, 3=40, 4=50, 5=60, 6=70, 7=1000
function getRewardForMatches(matches: number): number {
  if (matches === 7) return 1000;
  const rewards: Record<number, number> = {
    0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 70,
  };
  return rewards[matches] || 10;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { 
      telegramId, 
      selectedNumbers, 
      drawnNumbers, 
      drawSlot, 
      drawTime 
    } = await req.json();
    
    if (!telegramId || !selectedNumbers || !drawnNumbers) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Calculate matches and reward
    const matches = selectedNumbers.filter((n: number) => drawnNumbers.includes(n)).length;
    const reward = getRewardForMatches(matches);
    
    // Save game history
    const { error: historyError } = await supabase
      .from("game_history")
      .insert({
        user_id: user.id,
        selected_numbers: selectedNumbers,
        drawn_numbers: drawnNumbers,
        matches,
        reward,
        draw_slot: drawSlot,
        draw_time: drawTime,
      });
    
    if (historyError) {
      console.error("Error saving game history:", historyError);
    }
    
    // Update user's coins and total winnings
    const newCoins = user.coins + reward;
    const newTotalWinnings = user.total_winnings + reward;
    
    await supabase
      .from("users")
      .update({ 
        coins: newCoins,
        total_winnings: newTotalWinnings,
      })
      .eq("id", user.id);
    
    return new Response(JSON.stringify({ 
      success: true,
      matches,
      reward,
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
