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
    
    console.log(`[SYNC-USER] Syncing user ${telegramId}`);
    
    // Get or create user
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    
    let currentUser = user;
    
    if (!currentUser) {
      console.log(`[SYNC-USER] User ${telegramId} not found, creating new user`);
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          telegram_id: telegramId,
          first_name: firstName || "",
          last_name: lastName || "",
          username: username || "",
          photo_url: photoUrl || "",
          coins: 500, // Welcome bonus
          tickets: 3, // Free tickets for new users
        })
        .select()
        .single();
      
      if (createError) {
        console.error("[SYNC-USER] Error creating user:", createError);
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      currentUser = newUser;
      console.log(`[SYNC-USER] Created new user with id: ${newUser.id}`);
    } else {
      console.log(`[SYNC-USER] Found existing user: ${currentUser.id}`);
      
      // Update user info if changed
      const updates: any = {};
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
          console.log(`[SYNC-USER] Updated user info`);
        }
      }
      
      // Count actual referrals from referrals table
      const { count: referralCount } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", currentUser.id);
      
      console.log(`[SYNC-USER] Actual referral count from referrals table: ${referralCount}`);
      
      // Update referral_count if it's different from actual count
      if (referralCount !== null && referralCount !== currentUser.referral_count) {
        console.log(`[SYNC-USER] Updating referral_count from ${currentUser.referral_count} to ${referralCount}`);
        await supabase
          .from("users")
          .update({ referral_count: referralCount })
          .eq("id", currentUser.id);
        currentUser.referral_count = referralCount;
      }
      
      // Calculate task_invite_friend (min of referral_count and 2 for task completion)
      // This ensures the task counter shows correctly
      const taskInviteFriend = Math.min(referralCount || 0, 2);
      if (taskInviteFriend !== currentUser.task_invite_friend) {
        console.log(`[SYNC-USER] Syncing task_invite_friend to ${taskInviteFriend}`);
        await supabase
          .from("users")
          .update({ task_invite_friend: taskInviteFriend })
          .eq("id", currentUser.id);
        currentUser.task_invite_friend = taskInviteFriend;
      }
    }
    
    console.log(`[SYNC-USER] Returning user data - coins: ${currentUser.coins}, referral_count: ${currentUser.referral_count}, task_invite_friend: ${currentUser.task_invite_friend}`);
    
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
