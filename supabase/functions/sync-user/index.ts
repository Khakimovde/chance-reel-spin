import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function dbQuery(fn: () => Promise<any>, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    const result = await fn();
    if (!result.error) return result;
    const msg = result.error?.message || "";
    if (msg.includes("timeout") || msg.includes("upstream")) {
      console.warn(`[SYNC-USER] DB timeout, retry ${i + 1}/${retries}...`);
      await delay(500 * (i + 1));
      continue;
    }
    return result; // Non-timeout error, return immediately
  }
  return await fn(); // Final attempt
}

async function getOrCreateUser(telegramId: number, firstName: string, lastName: string, username: string, photoUrl: string) {
  const { data: user, error: fetchError } = await dbQuery(() =>
    supabase.from("users").select("*").eq("telegram_id", telegramId).maybeSingle()
  );

  if (user) return user;
  if (fetchError) console.warn("[SYNC-USER] Fetch error:", fetchError.message);

  console.log(`[SYNC-USER] User ${telegramId} not found, creating...`);
  const { data: newUser, error: insertError } = await dbQuery(() =>
    supabase.from("users").insert({
      telegram_id: telegramId,
      first_name: firstName || "",
      last_name: lastName || "",
      username: username || "",
      photo_url: photoUrl || "",
      coins: 500,
      tickets: 3,
    }).select().single()
  );

  if (!insertError && newUser) {
    console.log(`[SYNC-USER] Created user ${newUser.id}`);
    return newUser;
  }

  // Race condition — fetch existing
  console.warn(`[SYNC-USER] Insert failed (${insertError?.code}), fetching existing...`);
  await delay(300);
  const { data: existing } = await dbQuery(() =>
    supabase.from("users").select("*").eq("telegram_id", telegramId).single()
  );

  if (existing) {
    console.log(`[SYNC-USER] Found user after race: ${existing.id}`);
    return existing;
  }
  return null;
}

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
    
    console.log(`[SYNC-USER] Syncing user ${telegramId}`);
    
    let currentUser = await getOrCreateUser(telegramId, firstName || "", lastName || "", username || "", photoUrl || "");
    
    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Failed to sync user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Update user info if changed (only for existing users)
    const updates: Record<string, string> = {};
    if (firstName && firstName !== currentUser.first_name) updates.first_name = firstName;
    if (lastName && lastName !== currentUser.last_name) updates.last_name = lastName;
    if (username && username !== currentUser.username) updates.username = username;
    if (photoUrl && photoUrl !== currentUser.photo_url) updates.photo_url = photoUrl;
    
    if (Object.keys(updates).length > 0) {
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("telegram_id", telegramId)
        .select()
        .single();
      
      if (!updateError && updatedUser) {
        currentUser = updatedUser;
      }
    }
    
    // Count actual referrals
    const { count: referralCount } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", currentUser.id);
    
    if (referralCount !== null && referralCount !== currentUser.referral_count) {
      await supabase
        .from("users")
        .update({ referral_count: referralCount })
        .eq("id", currentUser.id);
      currentUser.referral_count = referralCount;
    }
    
    // Check 6-hour task reset
    const now = new Date();
    const currentHour = now.getUTCHours();
    const resetHours = [0, 6, 12, 18];
    
    let prevResetHour = 0;
    for (const h of resetHours) {
      if (h <= currentHour) prevResetHour = h;
    }
    
    const prevResetTime = new Date(now);
    prevResetTime.setUTCHours(prevResetHour, 0, 0, 0);
    
    const lastTaskReset = currentUser.last_task_reset ? new Date(currentUser.last_task_reset) : null;
    const shouldResetTasks = !lastTaskReset || prevResetTime.getTime() > lastTaskReset.getTime();
    
    if (shouldResetTasks) {
      await supabase
        .from("users")
        .update({ 
          task_invite_friend: 0,
          task_watch_ad: 0,
          last_task_reset: now.toISOString()
        })
        .eq("id", currentUser.id);
      currentUser.task_invite_friend = 0;
      currentUser.task_watch_ad = 0;
      currentUser.last_task_reset = now.toISOString();
    }
    
    console.log(`[SYNC-USER] Done - coins: ${currentUser.coins}, refs: ${currentUser.referral_count}`);
    
    return new Response(JSON.stringify({ user: currentUser }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC-USER] Error:", err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
