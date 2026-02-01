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

async function editTelegramMessage(chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  let referrerTelegramId: number | null = null;
  
  if (text.includes("ref_")) {
    const refId = text.split("ref_")[1];
    if (refId && refId !== String(telegramId)) {
      // Find referrer by telegram_id
      const { data: referrer } = await supabase
        .from("users")
        .select("id, telegram_id, coins, referral_count")
        .eq("telegram_id", parseInt(refId))
        .maybeSingle();
      
      if (referrer) {
        referredBy = referrer.id;
        referrerTelegramId = referrer.telegram_id;
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
      coins: 500,
      tickets: 3,
      referred_by: referredBy,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating user:", error);
    await sendTelegramMessage(telegramId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    return;
  }
  
  // If referred, reward the referrer with 50 coins (profile referral)
  if (referredBy && referrerTelegramId) {
    // Create referral record
    await supabase.from("referrals").insert({
      referrer_id: referredBy,
      referred_id: newUser.id,
    });
    
    // Get referrer's current data
    const { data: referrerData } = await supabase
      .from("users")
      .select("coins, referral_count, task_invite_friend")
      .eq("id", referredBy)
      .single();
    
    if (referrerData) {
      // Base referral reward: 50 coins
      let rewardAmount = 50;
      let taskCompleted = false;
      
      // Check if this counts towards task completion (first 2 referrals per period)
      const newTaskCount = referrerData.task_invite_friend + 1;
      
      // Update referrer: add coins and increment counts
      await supabase
        .from("users")
        .update({ 
          coins: referrerData.coins + rewardAmount,
          referral_count: referrerData.referral_count + 1,
          task_invite_friend: newTaskCount
        })
        .eq("id", referredBy);
      
      // If task is now complete (2 friends), give bonus reward
      if (newTaskCount === 2) {
        taskCompleted = true;
        // Give additional 100 coins for completing the task (200 total - 2x50 already given)
        await supabase
          .from("users")
          .update({ 
            coins: referrerData.coins + rewardAmount + 100
          })
          .eq("id", referredBy);
        rewardAmount = 150; // Total for this referral including task bonus
      }
      
      // Notify referrer
      let notifyMessage = `🎉 <b>Yangi referal!</b>\n\n${firstName} sizning havolangiz orqali qo'shildi.\n💰 +${rewardAmount} tanga qo'shildi!`;
      if (taskCompleted) {
        notifyMessage += `\n\n🏆 Vazifa bajarildi! 2 ta do'st taklif qildingiz!`;
      }
      
      await sendTelegramMessage(referrerTelegramId, notifyMessage);
    }
  }
  
  await sendTelegramMessage(
    telegramId,
    `🎰 <b>Xush kelibsiz, ${firstName}!</b>\n\nSiz muvaffaqiyatli ro'yxatdan o'tdingiz!\n\n🎁 Bonus: 500 tanga va 3 ta bepul chipta!\n\nO'yinni boshlash uchun ilovani oching.`
  );
}

async function handleWithdrawalAction(callbackQuery: any) {
  const data = callbackQuery.data;
  const adminId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  
  if (String(adminId) !== TELEGRAM_ADMIN_ID) {
    return;
  }
  
  const parts = data.split("_");
  const action = parts[0];
  const actualId = parts.slice(1).join("_");
  
  let newStatus = "";
  let userMessage = "";
  let statusEmoji = "";
  let statusText = "";
  
  if (action === "approve") {
    newStatus = "approved";
    userMessage = "✅ Sizning pul yechish so'rovingiz qabul qilindi. Tez orada to'lov amalga oshiriladi.";
    statusEmoji = "✅";
    statusText = "TASDIQLANGAN";
  } else if (action === "pay") {
    newStatus = "paid";
    userMessage = "💰 Sizning pulingiz to'landi! Rahmat!";
    statusEmoji = "💰";
    statusText = "TO'LANGAN";
  } else if (action === "reject") {
    newStatus = "rejected";
    userMessage = "❌ Sizning pul yechish so'rovingiz rad etildi. Tangalaringiz balansga qaytarildi.";
    statusEmoji = "❌";
    statusText = "RAD ETILGAN";
  } else {
    return;
  }
  
  const withdrawalIdClean = actualId;
  
  // Get withdrawal info first
  const { data: withdrawal, error: fetchError } = await supabase
    .from("withdrawals")
    .select("*, user:users(*)")
    .eq("id", withdrawalIdClean)
    .single();
  
  if (fetchError || !withdrawal) {
    console.error("Error fetching withdrawal:", fetchError);
    await sendTelegramMessage(adminId, "❌ So'rov topilmadi");
    return;
  }
  
  // If rejecting, return coins to user
  if (action === "reject") {
    const { data: userData } = await supabase
      .from("users")
      .select("coins")
      .eq("id", withdrawal.user_id)
      .single();
    
    if (userData) {
      await supabase
        .from("users")
        .update({ coins: userData.coins + withdrawal.amount })
        .eq("id", withdrawal.user_id);
    }
  }
  
  // Update withdrawal status
  const { error: updateError } = await supabase
    .from("withdrawals")
    .update({ 
      status: newStatus,
      processed_at: new Date().toISOString()
    })
    .eq("id", withdrawalIdClean);
  
  if (updateError) {
    console.error("Error updating withdrawal:", updateError);
    await sendTelegramMessage(adminId, "❌ Xatolik yuz berdi");
    return;
  }
  
  // Notify user
  if (withdrawal.user) {
    await sendTelegramMessage(withdrawal.user.telegram_id, userMessage);
  }
  
  // Update admin message with new status and appropriate buttons
  const updatedMessage = `${statusEmoji} <b>Pul yechish so'rovi - ${statusText}</b>\n\n` +
    `👤 Foydalanuvchi: ${withdrawal.user?.first_name || ''} ${withdrawal.user?.last_name || ''}\n` +
    `📱 Username: @${withdrawal.user?.username || "yo'q"}\n` +
    `🆔 Telegram ID: ${withdrawal.user?.telegram_id}\n` +
    `💵 Miqdor: ${withdrawal.amount} tanga\n` +
    `📍 Hamyon: ${withdrawal.wallet_address || "ko'rsatilmagan"}\n` +
    `✅ Holat: ${statusText}`;
  
  // Only show "To'lash" button for approved status
  let keyboard = undefined;
  if (newStatus === "approved") {
    keyboard = {
      inline_keyboard: [
        [{ text: "💰 To'lash", callback_data: `pay_${withdrawalIdClean}` }],
      ],
    };
  }
  
  if (messageId) {
    await editTelegramMessage(adminId, messageId, updatedMessage, keyboard);
  } else {
    await sendTelegramMessage(adminId, updatedMessage, keyboard);
  }
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
