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
  
  console.log(`[START] User ${telegramId} (${firstName}) starting bot`);
  
  // Check for referral
  const text = message.text || "";
  let referredBy: string | null = null;
  let referrerTelegramId: number | null = null;
  
  if (text.includes("ref_")) {
    const refId = text.split("ref_")[1]?.split(" ")[0];
    console.log(`[REFERRAL] Found referral code: ref_${refId}`);
    
    if (refId && refId !== String(telegramId)) {
      // Find referrer by telegram_id
      const { data: referrer } = await supabase
        .from("users")
        .select("id, telegram_id, coins, referral_count, task_invite_friend")
        .eq("telegram_id", parseInt(refId))
        .maybeSingle();
      
      if (referrer) {
        console.log(`[REFERRAL] Found referrer: ${referrer.id} (telegram_id: ${referrer.telegram_id})`);
        referredBy = referrer.id;
        referrerTelegramId = referrer.telegram_id;
      } else {
        console.log(`[REFERRAL] Referrer with telegram_id ${refId} not found`);
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
    console.log(`[START] User ${telegramId} already exists, skipping message`);
    // Don't send any message for existing users - they just need to open the app
    return;
  }
  
  // Create new user
  console.log(`[START] Creating new user ${telegramId}`);
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
    console.error("[START] Error creating user:", error);
    await sendTelegramMessage(telegramId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    return;
  }
  
  console.log(`[START] User ${telegramId} created successfully with id: ${newUser.id}`);
  
  // If referred, reward the referrer
  if (referredBy && referrerTelegramId) {
    console.log(`[REFERRAL] Processing referral reward for referrer ${referredBy}`);
    
    // Create referral record
    const { error: refError } = await supabase.from("referrals").insert({
      referrer_id: referredBy,
      referred_id: newUser.id,
    });
    
    if (refError) {
      console.error("[REFERRAL] Error creating referral record:", refError);
    } else {
      console.log("[REFERRAL] Referral record created");
    }
    
    // Get referrer's current data
    const { data: referrerData } = await supabase
      .from("users")
      .select("coins, referral_count, task_invite_friend")
      .eq("id", referredBy)
      .single();
    
    if (referrerData) {
      // Profile referral reward: 50 coins (unlimited)
      const profileReward = 50;
      const newReferralCount = referrerData.referral_count + 1;
      const newTaskCount = referrerData.task_invite_friend + 1;
      
      console.log(`[REFERRAL] Referrer current stats - coins: ${referrerData.coins}, referral_count: ${referrerData.referral_count}, task_invite_friend: ${referrerData.task_invite_friend}`);
      
      // Calculate total reward
      let totalReward = profileReward; // Always give 50 for profile referral
      let taskBonusGiven = false;
      
      // Check if task bonus should be given (when reaching exactly 2 referrals in current task period)
      if (newTaskCount === 2) {
        totalReward += 160; // Task bonus: 160 coins for completing 2 invites
        taskBonusGiven = true;
        console.log(`[REFERRAL] Task bonus triggered! +160 coins`);
      }
      
      // Update referrer's data
      const { error: updateError } = await supabase
        .from("users")
        .update({ 
          coins: referrerData.coins + totalReward,
          referral_count: newReferralCount,
          task_invite_friend: newTaskCount
        })
        .eq("id", referredBy);
      
      if (updateError) {
        console.error("[REFERRAL] Error updating referrer:", updateError);
      } else {
        console.log(`[REFERRAL] Referrer updated - new coins: ${referrerData.coins + totalReward}, new referral_count: ${newReferralCount}, task_invite_friend: ${newTaskCount}`);
      }
      
      // Notify referrer
      let notifyMessage = `🎉 <b>Yangi referal!</b>\n\n${firstName} sizning havolangiz orqali qo'shildi.\n💰 +${profileReward} tanga qo'shildi!`;
      if (taskBonusGiven) {
        notifyMessage += `\n\n🏆 <b>Vazifa bajarildi!</b>\n2 ta do'st taklif qildingiz!\n💰 +160 bonus tanga qo'shildi!`;
      }
      notifyMessage += `\n\n📊 Jami referallar: ${newReferralCount}`;
      
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
  
  console.log(`[WITHDRAWAL] Admin ${adminId} action: ${data}`);
  
  if (String(adminId) !== TELEGRAM_ADMIN_ID) {
    console.log(`[WITHDRAWAL] Unauthorized: ${adminId} != ${TELEGRAM_ADMIN_ID}`);
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
    console.log(`[WITHDRAWAL] Unknown action: ${action}`);
    return;
  }
  
  const withdrawalIdClean = actualId;
  console.log(`[WITHDRAWAL] Processing withdrawal ${withdrawalIdClean} with action ${action}`);
  
  // Get withdrawal info first
  const { data: withdrawal, error: fetchError } = await supabase
    .from("withdrawals")
    .select("*, user:users(*)")
    .eq("id", withdrawalIdClean)
    .single();
  
  if (fetchError || !withdrawal) {
    console.error("[WITHDRAWAL] Error fetching withdrawal:", fetchError);
    await sendTelegramMessage(adminId, "❌ So'rov topilmadi");
    return;
  }
  
  console.log(`[WITHDRAWAL] Found withdrawal: amount=${withdrawal.amount}, status=${withdrawal.status}, user_id=${withdrawal.user_id}`);
  
  // If rejecting, return coins to user
  if (action === "reject") {
    const { data: userData } = await supabase
      .from("users")
      .select("coins")
      .eq("id", withdrawal.user_id)
      .single();
    
    if (userData) {
      console.log(`[WITHDRAWAL] Returning ${withdrawal.amount} coins to user (current: ${userData.coins})`);
      const { error: refundError } = await supabase
        .from("users")
        .update({ coins: userData.coins + withdrawal.amount })
        .eq("id", withdrawal.user_id);
      
      if (refundError) {
        console.error("[WITHDRAWAL] Error refunding coins:", refundError);
      } else {
        console.log(`[WITHDRAWAL] Coins refunded successfully, new balance: ${userData.coins + withdrawal.amount}`);
      }
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
    console.error("[WITHDRAWAL] Error updating withdrawal:", updateError);
    await sendTelegramMessage(adminId, "❌ Xatolik yuz berdi");
    return;
  }
  
  console.log(`[WITHDRAWAL] Status updated to ${newStatus}`);
  
  // Notify user
  if (withdrawal.user) {
    await sendTelegramMessage(withdrawal.user.telegram_id, userMessage);
    console.log(`[WITHDRAWAL] User ${withdrawal.user.telegram_id} notified`);
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
  
  console.log(`[WITHDRAWAL] Admin message updated`);
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
