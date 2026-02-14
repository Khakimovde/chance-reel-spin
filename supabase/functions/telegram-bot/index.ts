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

async function handleUsersCommand(message: any) {
  const adminId = message.from.id;
  const configuredAdminId = TELEGRAM_ADMIN_ID;
  
  console.log(`[USERS] Received /users command from ${adminId}, configured admin ID: "${configuredAdminId}"`);
  console.log(`[USERS] Comparison: String(${adminId}) === "${configuredAdminId}" = ${String(adminId) === configuredAdminId}`);
  
  // Check if admin - compare as strings
  if (String(adminId) !== String(configuredAdminId)) {
    console.log(`[USERS] Unauthorized access attempt by ${adminId}`);
    await sendTelegramMessage(adminId, "⛔ Sizda admin huquqi yo'q");
    return;
  }
  
  console.log(`[USERS] Admin ${adminId} requesting users list`);
  
  try {
    // Get total count using COUNT (avoids 1000 row limit)
    const { count: totalCount, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    
    if (countError) {
      console.error("[USERS] Count error:", countError);
    }
    
    // Get top 50 users by coins
    const { data: topUsers, error } = await supabase
      .from("users")
      .select("telegram_id, username, first_name, last_name, coins, referral_count, tickets, total_winnings, task_watch_ad, task_invite_friend, created_at")
      .order("coins", { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("[USERS] Error fetching users:", error);
      await sendTelegramMessage(adminId, "❌ Foydalanuvchilarni olishda xatolik: " + error.message);
      return;
    }
    
    // Get today's new users count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());
    
    // Get total coins in system (batch fetch to avoid 1000 limit)
    let totalCoins = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: coinsBatch } = await supabase
        .from("users")
        .select("coins")
        .range(offset, offset + batchSize - 1);
      
      if (coinsBatch && coinsBatch.length > 0) {
        totalCoins += coinsBatch.reduce((sum: number, u: any) => sum + (u.coins || 0), 0);
        offset += batchSize;
        if (coinsBatch.length < batchSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    
    // Format message
    let msg = `📊 <b>Foydalanuvchilar statistikasi</b>\n\n`;
    msg += `👥 Jami foydalanuvchilar: <b>${totalCount?.toLocaleString() || 0}</b>\n`;
    msg += `🆕 Bugun qo'shilgan: <b>${todayCount || 0}</b>\n`;
    msg += `💰 Tizimdagi jami tangalar: <b>${totalCoins.toLocaleString()}</b>\n\n`;
    
    msg += `🏆 <b>Top 50 foydalanuvchi:</b>\n\n`;
    
    topUsers?.forEach((user: any, index: number) => {
      const name = user.first_name || user.username || "Nomsiz";
      const uname = user.username ? `@${user.username}` : "";
      msg += `${index + 1}. ${name} ${uname}\n`;
      msg += `   🆔 <code>${user.telegram_id}</code>\n`;
      msg += `   💰 ${user.coins} | 🎟 ${user.tickets} | 👥 ${user.referral_count} ref\n`;
      msg += `   🏆 Yutug': ${user.total_winnings} | 📺 Reklama: ${user.task_watch_ad}\n\n`;
    });
    
    // Telegram has 4096 char limit
    if (msg.length > 4000) {
      msg = msg.substring(0, 3900) + "\n\n... (davomi cheklov sababli qisqartirildi)";
    }
    
    await sendTelegramMessage(adminId, msg);
    console.log(`[USERS] Sent users list to admin successfully`);
  } catch (err) {
    console.error("[USERS] Error:", err);
    await sendTelegramMessage(adminId, "❌ Xatolik yuz berdi: " + (err instanceof Error ? err.message : String(err)));
  }
}

async function checkChannelSubscription(telegramId: number, channel: string): Promise<boolean> {
  try {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${telegramId}`;
    const response = await fetch(telegramUrl);
    const data = await response.json();
    
    if (!data.ok) {
      console.log(`[SUBSCRIPTION] Check failed for user ${telegramId} in ${channel}:`, data.description);
      return false;
    }
    
    const status = data.result?.status;
    const isSubscribed = ["member", "administrator", "creator"].includes(status);
    console.log(`[SUBSCRIPTION] User ${telegramId} status in ${channel}: ${status} (subscribed: ${isSubscribed})`);
    return isSubscribed;
  } catch (err) {
    console.error("[SUBSCRIPTION] Error:", err);
    return false;
  }
}

async function handleStart(message: any) {
  const telegramId = message.from.id;
  const firstName = message.from.first_name || "";
  const lastName = message.from.last_name || "";
  const username = message.from.username || "";
  const photoUrl = message.from.photo_url || "";
  
  console.log(`[START] User ${telegramId} (${firstName}) starting bot`);
  
  // Mini app and support bot URLs
  const MINI_APP_URL = "https://691c729b6ca6a.xvest3.ru";
  const SUPPORT_BOT_URL = "https://t.me/Xakimovsupport_bot";
  const REQUIRED_CHANNEL = "@LuckyGame_uz";
  
  // Parse referral info from /start command
  const text = message.text || "";
  let refTelegramId: string | null = null;
  
  if (text.includes("ref_")) {
    const refId = text.split("ref_")[1]?.split(" ")[0];
    if (refId && refId !== String(telegramId)) {
      refTelegramId = refId;
      console.log(`[REFERRAL] Found referral telegram_id: ${refTelegramId}`);
    }
  }
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  
  // ALWAYS check channel subscription first
  const isSubscribed = await checkChannelSubscription(telegramId, REQUIRED_CHANNEL);
  
  if (!isSubscribed) {
    // Not subscribed - show subscription required message
    // Pass refTelegramId so we can process referral AFTER subscription is confirmed
    console.log(`[START] User ${telegramId} not subscribed to ${REQUIRED_CHANNEL}`);
    const subscriptionMessage = `📢 <b>Kanalga obuna bo'ling!</b>\n\n🎁 Lotoreyadan foydalanish uchun avval kanalimizga obuna bo'lishingiz kerak.\n\n👉 <a href="https://t.me/${REQUIRED_CHANNEL.replace('@', '')}">${REQUIRED_CHANNEL}</a>\n\n✅ Obuna bo'lgandan so'ng "Tekshirish" tugmasini bosing.`;
    
    const subscriptionKeyboard = {
      inline_keyboard: [
        [{ text: "📢 Kanalga o'tish", url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}` }],
        [{ text: "✅ Tekshirish", callback_data: `check_sub_reftg_${refTelegramId || 'none'}` }],
      ],
    };
    
    await sendTelegramMessage(telegramId, subscriptionMessage, subscriptionKeyboard);
    return;
  }
  
  // User IS subscribed - proceed
  const welcomeMessage = `👋 Salom, <b>${firstName}</b> 🌿!\n\n🎉 Xush kelibsiz!\n\n🎲 Bepul o'yini omadingizni sinab ko'ring va real daromadga ega bo'ling`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "🎲 Lotoreya", web_app: { url: MINI_APP_URL } }],
      [
        { text: "📕 Qoidalar", callback_data: "show_rules" },
        { text: "✉️ Aloqa uchun", url: SUPPORT_BOT_URL },
      ],
    ],
  };
  
  if (existingUser) {
    console.log(`[START] User ${telegramId} already exists, sending welcome message`);
    await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
    return;
  }
  
  // New user - resolve referrer if present
  let referredBy: string | null = null;
  let referrerTelegramId: number | null = null;
  
  if (refTelegramId) {
    const { data: referrer } = await supabase
      .from("users")
      .select("id, telegram_id")
      .eq("telegram_id", parseInt(refTelegramId))
      .maybeSingle();
    
    if (referrer) {
      referredBy = referrer.id;
      referrerTelegramId = referrer.telegram_id;
      console.log(`[REFERRAL] Resolved referrer: ${referrer.id}`);
    }
  }
  
  // Create new user with 300 coins welcome bonus
  console.log(`[START] Creating new user ${telegramId}`);
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      telegram_id: telegramId,
      first_name: firstName,
      last_name: lastName,
      username,
      photo_url: photoUrl,
      coins: 300,
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
  
  // Process referral reward (user already passed subscription check)
  if (referredBy && referrerTelegramId) {
    await processReferralReward(referredBy, referrerTelegramId, newUser.id, firstName);
  }
  
  // Send welcome message with buttons
  await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
}

async function processReferralReward(referrerId: string, referrerTelegramId: number, newUserId: string, newUserName: string) {
  console.log(`[REFERRAL] Processing referral reward for referrer ${referrerId}`);
  
  // Create referral record
  const { error: refError } = await supabase.from("referrals").insert({
    referrer_id: referrerId,
    referred_id: newUserId,
  });
  
  if (refError) {
    console.error("[REFERRAL] Error creating referral record:", refError);
  } else {
    console.log("[REFERRAL] Referral record created");
  }
  
  // Get referrer's current data
  const { data: referrerData } = await supabase
    .from("users")
    .select("coins, referral_count, task_invite_friend, last_task_reset")
    .eq("id", referrerId)
    .single();
  
  if (referrerData) {
    // Profile referral reward: 50 coins (unlimited)
    const profileReward = 50;
    const newReferralCount = referrerData.referral_count + 1;
    
    console.log(`[REFERRAL] Referrer current stats - coins: ${referrerData.coins}, referral_count: ${referrerData.referral_count}, task_invite_friend: ${referrerData.task_invite_friend}`);
    
  // Check if task needs reset first (2-hour reset)
    const now = new Date();
    const currentHour = now.getHours();
    const resetHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    
    let prevResetHour = 0;
    for (const h of resetHours) {
      if (h <= currentHour) {
        prevResetHour = h;
      }
    }
    
    const prevResetTime = new Date(now);
    prevResetTime.setHours(prevResetHour, 0, 0, 0);
    
    const lastTaskReset = referrerData.last_task_reset ? new Date(referrerData.last_task_reset) : null;
    const shouldResetTasks = !lastTaskReset || prevResetTime.getTime() > lastTaskReset.getTime();
    
    // Calculate task count after potential reset
    let currentTaskCount = referrerData.task_invite_friend;
    if (shouldResetTasks) {
      currentTaskCount = 0;
      console.log(`[REFERRAL] Task reset triggered for referrer (2-hour period)`);
    }
    
    // Only increment task_invite_friend if under 2 (max for task period)
    const newTaskCount = Math.min(currentTaskCount + 1, 2);
    
    // Calculate total reward
    let totalReward = profileReward; // Always give 50 for profile referral
    let taskBonusGiven = false;
    
    // Check if task bonus should be given (when reaching exactly 2 referrals in current task period)
    if (newTaskCount === 2 && currentTaskCount < 2) {
      totalReward += 100; // Task bonus: 100 coins for completing 2 invites
      taskBonusGiven = true;
      console.log(`[REFERRAL] Task bonus triggered! +160 coins`);
    }
    
    // Update referrer's data
    const updateData: any = { 
      coins: referrerData.coins + totalReward,
      referral_count: newReferralCount,
      task_invite_friend: newTaskCount
    };
    
    // If reset was needed, also update last_task_reset
    if (shouldResetTasks) {
      updateData.last_task_reset = now.toISOString();
      updateData.task_watch_ad = 0; // Also reset ads
    }
    
    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", referrerId);
    
    if (updateError) {
      console.error("[REFERRAL] Error updating referrer:", updateError);
    } else {
      console.log(`[REFERRAL] Referrer updated - new coins: ${referrerData.coins + totalReward}, new referral_count: ${newReferralCount}, task_invite_friend: ${newTaskCount}`);
    }
    
    // Notify referrer
    let notifyMessage = `🎉 <b>Yangi referal!</b>\n\n${newUserName} sizning havolangiz orqali qo'shildi.\n💰 +${profileReward} tanga qo'shildi!`;
    if (taskBonusGiven) {
      notifyMessage += `\n\n🏆 <b>Vazifa bajarildi!</b>\n2 ta do'st taklif qildingiz!\n💰 +100 bonus tanga qo'shildi!`;
    }
    notifyMessage += `\n\n📊 Jami referallar: ${newReferralCount}`;
    
    await sendTelegramMessage(referrerTelegramId, notifyMessage);
  }
}

async function handleSubscriptionCheck(callbackQuery: any) {
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;
  const firstName = callbackQuery.from.first_name || "";
  const lastName = callbackQuery.from.last_name || "";
  const username = callbackQuery.from.username || "";
  
  console.log(`[SUBSCRIPTION CHECK] User ${telegramId} checking subscription`);
  
  const REQUIRED_CHANNEL = "@LuckyGame_uz";
  const MINI_APP_URL = "https://691c729b6ca6a.xvest3.ru";
  const SUPPORT_BOT_URL = "https://t.me/Xakimovsupport_bot";
  
  // Parse referral telegram_id from callback data: check_sub_reftg_<telegram_id>
  const parts = data.split("_");
  // Format: check_sub_reftg_<telegramId>
  const refTelegramIdStr = parts[3] !== 'none' ? parts[3] : null;
  
  const isSubscribed = await checkChannelSubscription(telegramId, REQUIRED_CHANNEL);
  
  if (!isSubscribed) {
    // Still not subscribed
    console.log(`[SUBSCRIPTION CHECK] User ${telegramId} still not subscribed`);
    await sendTelegramMessage(telegramId, "❌ Siz hali kanalga obuna bo'lmagansiz!\n\n📢 Iltimos, avval kanalga obuna bo'ling va qaytadan tekshiring.");
    return;
  }
  
  // User is now subscribed!
  console.log(`[SUBSCRIPTION CHECK] User ${telegramId} is now subscribed!`);
  
  // Check if user exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  
  const welcomeMessage = `🎉 <b>Tabriklaymiz!</b>\n\n✅ Obuna tasdiqlandi!\n\n👋 Xush kelibsiz, <b>${firstName}</b>!\n\n🎲 Endi o'yinlardan foydalanishingiz mumkin!`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "🎲 Lotoreya", web_app: { url: MINI_APP_URL } }],
      [
        { text: "📕 Qoidalar", callback_data: "show_rules" },
        { text: "✉️ Aloqa uchun", url: SUPPORT_BOT_URL },
      ],
    ],
  };
  
  if (existingUser) {
    // User already exists, just update message
    if (messageId) {
      await editTelegramMessage(telegramId, messageId, welcomeMessage, keyboard);
    } else {
      await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
    }
    return;
  }
  
  // Resolve referrer from telegram_id
  let referredBy: string | null = null;
  let referrerTelegramId: number | null = null;
  
  if (refTelegramIdStr) {
    const { data: referrer } = await supabase
      .from("users")
      .select("id, telegram_id")
      .eq("telegram_id", parseInt(refTelegramIdStr))
      .maybeSingle();
    
    if (referrer) {
      referredBy = referrer.id;
      referrerTelegramId = referrer.telegram_id;
      console.log(`[SUBSCRIPTION CHECK] Resolved referrer: ${referrer.id} (tg: ${referrer.telegram_id})`);
    }
  }
  
  // Create new user
  console.log(`[SUBSCRIPTION CHECK] Creating new user ${telegramId}`);
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      telegram_id: telegramId,
      first_name: firstName,
      last_name: lastName,
      username,
      coins: 300,
      tickets: 3,
      referred_by: referredBy,
    })
    .select()
    .single();
  
  if (error) {
    console.error("[SUBSCRIPTION CHECK] Error creating user:", error);
    await sendTelegramMessage(telegramId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    return;
  }
  
  console.log(`[SUBSCRIPTION CHECK] User ${telegramId} created with id: ${newUser.id}`);
  
  // Process referral reward - user has passed subscription check
  if (referredBy && referrerTelegramId) {
    await processReferralReward(referredBy, referrerTelegramId, newUser.id, firstName);
  }
  
  // Update message with welcome
  if (messageId) {
    await editTelegramMessage(telegramId, messageId, welcomeMessage, keyboard);
  } else {
    await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
  }
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

async function handleShowRules(callbackQuery: any) {
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  
  const rulesText = `📕 <b>O'yin qoidalari</b>\n\n` +
    `🎲 <b>Lotoreya</b>\n` +
    `• Har 15 daqiqada qur'a o'tkaziladi\n` +
    `• 1 dan 36 gacha 7 ta raqam tanlang\n` +
    `• Har bir ishtirok uchun 1 ta chipta kerak\n` +
    `• Mos kelgan raqamlar soni bo'yicha mukofot beriladi\n\n` +
    `💰 <b>Tanga ishlash yo'llari</b>\n` +
    `• Reklama ko'rish (har 2 soatda yangilanadi)\n` +
    `• Do'stlarni taklif qilish (+50 tanga)\n` +
    `• Kanallarga obuna bo'lish\n` +
    `• G'ildirak aylantirish\n` +
    `• AR o'yinlar\n\n` +
    `💸 <b>Pul yechish</b>\n` +
    `• Minimal yechish: 10,000 tanga\n` +
    `• 10,000 tanga = 13,000 so'm\n` +
    `• So'rov 1-14 kun ichida ko'rib chiqiladi\n` +
    `• Karta raqami kiritish majburiy (16 raqam)\n\n` +
    `👥 <b>Referal tizimi</b>\n` +
    `• Har bir do'st uchun: 50 tanga\n` +
    `• Yangi foydalanuvchiga: 300 tanga bonus\n` +
    `• Do'st kanalga obuna bo'lgandan so'ng hisoblanadi`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "⬅️ Asosiy menuga qaytish", callback_data: "back_to_menu" }],
    ],
  };
  
  if (messageId) {
    await editTelegramMessage(telegramId, messageId, rulesText, keyboard);
  } else {
    await sendTelegramMessage(telegramId, rulesText, keyboard);
  }
}

async function handleBackToMenu(callbackQuery: any) {
  const telegramId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  const firstName = callbackQuery.from.first_name || "";
  
  const MINI_APP_URL = "https://691c729b6ca6a.xvest3.ru";
  const SUPPORT_BOT_URL = "https://t.me/Xakimovsupport_bot";
  
  const welcomeMessage = `👋 Salom, <b>${firstName}</b> 🌿!\n\n🎉 Xush kelibsiz!\n\n🎲 Bepul o'yini omadingizni sinab ko'ring va real daromadga ega bo'ling`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "🎲 Lotoreya", web_app: { url: MINI_APP_URL } }],
      [
        { text: "📕 Qoidalar", callback_data: "show_rules" },
        { text: "✉️ Aloqa uchun", url: SUPPORT_BOT_URL },
      ],
    ],
  };
  
  if (messageId) {
    await editTelegramMessage(telegramId, messageId, welcomeMessage, keyboard);
  } else {
    await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
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
      
      if (text === "/users") {
        await handleUsersCommand(message);
      }
    }
    
    if (body.callback_query) {
      const callbackData = body.callback_query.data || "";
      if (callbackData.startsWith("check_sub_")) {
        await handleSubscriptionCheck(body.callback_query);
      } else if (callbackData === "show_rules") {
        await handleShowRules(body.callback_query);
      } else if (callbackData === "back_to_menu") {
        await handleBackToMenu(body.callback_query);
      } else {
        await handleWithdrawalAction(body.callback_query);
      }
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
