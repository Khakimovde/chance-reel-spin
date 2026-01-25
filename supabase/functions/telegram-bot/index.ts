import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_ADMIN_ID = Deno.env.get("TELEGRAM_ADMIN_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function handleStart(message: any) {
  const telegramId = message.from.id;
  const firstName = message.from.first_name || "";
  const lastName = message.from.last_name || "";
  const username = message.from.username || "";
  const photoUrl = message.from.photo_url || "";
  
  // Check for referral
  const text = message.text || "";
  let referredBy: string | null = null;
  if (text.includes("ref_")) {
    const refId = text.split("ref_")[1];
    if (refId && refId !== String(telegramId)) {
      // Find referrer by telegram_id
      const { data: referrer } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(refId))
        .maybeSingle();
      
      if (referrer) {
        referredBy = referrer.id;
      }
    }
  }
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  
  if (existingUser) {
    await sendTelegramMessage(
      telegramId,
      `🎰 <b>Salom, ${firstName}!</b>\n\nSiz allaqachon ro'yxatdan o'tgansiz.\n\n💰 Balans: ${existingUser.coins} tanga\n🎫 Chiptalar: ${existingUser.tickets}\n\nIlovani ochish uchun quyidagi tugmani bosing:`
    );
    return;
  }
  
  // Create new user
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      telegram_id: telegramId,
      first_name: firstName,
      last_name: lastName,
      username,
      photo_url: photoUrl,
      coins: 0,
      tickets: 1, // 1 free ticket for new users
      referred_by: referredBy,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating user:", error);
    await sendTelegramMessage(telegramId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    return;
  }
  
  // If referred, reward the referrer
  if (referredBy) {
    // Create referral record
    await supabase.from("referrals").insert({
      referrer_id: referredBy,
      referred_id: newUser.id,
    });
    
    // Get referrer data first
    const { data: referrerData } = await supabase
      .from("users")
      .select("coins, referral_count, telegram_id")
      .eq("id", referredBy)
      .single();
    
    if (referrerData) {
      // Update the referrer with 30 coins reward
      await supabase
        .from("users")
        .update({ 
          coins: referrerData.coins + 30,
          referral_count: referrerData.referral_count + 1
        })
        .eq("id", referredBy);
      
      // Notify referrer
      await sendTelegramMessage(
        referrerData.telegram_id,
        `🎉 <b>Yangi referal!</b>\n\n${firstName} sizning havolangiz orqali qo'shildi.\n💰 +30 tanga qo'shildi!`
      );
    }
  }
  
  await sendTelegramMessage(
    telegramId,
    `🎰 <b>Xush kelibsiz, ${firstName}!</b>\n\nSiz muvaffaqiyatli ro'yxatdan o'tdingiz!\n\n🎁 Bonus: 1 ta bepul chipta!\n\nO'yinni boshlash uchun ilovani oching.`
  );
}

async function handleWithdrawalAction(callbackQuery: any) {
  const data = callbackQuery.data;
  const adminId = callbackQuery.from.id;
  
  if (String(adminId) !== TELEGRAM_ADMIN_ID) {
    return;
  }
  
  const parts = data.split("_");
  const action = parts[0];
  const actualId = parts.slice(1).join("_");
  
  let newStatus = "";
  let userMessage = "";
  
  if (data.startsWith("approve_")) {
    newStatus = "approved";
    userMessage = "✅ Sizning pul yechish so'rovingiz qabul qilindi. Tez orada to'lov amalga oshiriladi.";
  } else if (data.startsWith("pay_")) {
    newStatus = "paid";
    userMessage = "💰 Sizning pulingiz to'landi! Rahmat!";
  } else if (data.startsWith("reject_")) {
    newStatus = "rejected";
    userMessage = "❌ Sizning pul yechish so'rovingiz rad etildi.";
  } else {
    return;
  }
  
  const withdrawalIdClean = actualId;
  
  // Update withdrawal status
  const { data: withdrawal, error } = await supabase
    .from("withdrawals")
    .update({ 
      status: newStatus,
      processed_at: new Date().toISOString()
    })
    .eq("id", withdrawalIdClean)
    .select("*, user:users(*)")
    .single();
  
  if (error || !withdrawal) {
    console.error("Error updating withdrawal:", error);
    return;
  }
  
  // Notify user
  if (withdrawal.user) {
    await sendTelegramMessage(withdrawal.user.telegram_id, userMessage);
  }
  
  // Update admin message
  const statusEmoji = newStatus === "approved" ? "✅" : newStatus === "paid" ? "💰" : "❌";
  await sendTelegramMessage(
    adminId,
    `${statusEmoji} So'rov ${newStatus === "approved" ? "qabul qilindi" : newStatus === "paid" ? "to'landi" : "rad etildi"}.\nID: ${withdrawalIdClean}`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    console.log("Received update:", JSON.stringify(body));
    
    if (body.message) {
      const message = body.message;
      const text = message.text || "";
      
      if (text.startsWith("/start")) {
        await handleStart(message);
      }
    }
    
    if (body.callback_query) {
      await handleWithdrawalAction(body.callback_query);
    }
    
    return new Response(JSON.stringify({ ok: true }), {
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
