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

// Track admin states (broadcast mode)
const adminStates = new Map<number, string>();

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

async function sendTelegramPhoto(chatId: string | number, photoFileId: string, caption?: string) {
  const body: any = {
    chat_id: chatId,
    photo: photoFileId,
    parse_mode: "HTML",
  };
  if (caption) body.caption = caption;
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
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

// ============ ADMIN COMMAND ============

async function handleAdminCommand(message: any) {
  const userId = message.from.id;
  
  if (String(userId) !== String(TELEGRAM_ADMIN_ID)) {
    await sendTelegramMessage(userId, "⛔ Sizda admin huquqi yo'q");
    return;
  }

  console.log(`[ADMIN] Admin ${userId} opened admin panel`);
  
  // Send admin menu with reply keyboard
  const keyboard = {
    keyboard: [
      [{ text: "📨 Xabar yuborish" }, { text: "📊 Statistika" }],
      [{ text: "❌ Admin panelni yopish" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
  
  await sendTelegramMessage(userId, "🔧 <b>Admin panel</b>\n\nQuyidagi tugmalardan birini tanlang:", keyboard);
}

async function handleAdminStats(message: any) {
  const userId = message.from.id;
  if (String(userId) !== String(TELEGRAM_ADMIN_ID)) return;
  
  console.log(`[ADMIN] Stats requested by ${userId}`);
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    
    // Run all independent queries in parallel for speed
    const [
      totalUsersRes,
      todayUsersRes,
      pendingRes,
      approvedRes,
      totalReferralsRes,
      todayGamesRes,
      dailyStatsRes,
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", todayStr),
      supabase.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("referrals").select("*", { count: "exact", head: true }),
      supabase.from("game_history").select("*", { count: "exact", head: true }).gte("created_at", todayStr),
      supabase.from("daily_stats").select("ads_watched").eq("date", today.toISOString().split("T")[0]).maybeSingle(),
    ]);
    
    // Total coins - batch (still needed)
    let totalCoins = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: batch } = await supabase.from("users").select("coins").range(offset, offset + batchSize - 1);
      if (batch && batch.length > 0) {
        totalCoins += batch.reduce((s: number, u: any) => s + (u.coins || 0), 0);
        offset += batchSize;
        if (batch.length < batchSize) hasMore = false;
      } else hasMore = false;
    }
    
    // Total paid - batch
    let totalPaid = 0;
    let paidOffset = 0;
    let paidMore = true;
    while (paidMore) {
      const { data: paidBatch } = await supabase.from("withdrawals").select("amount").eq("status", "paid").range(paidOffset, paidOffset + batchSize - 1);
      if (paidBatch && paidBatch.length > 0) {
        totalPaid += paidBatch.reduce((s: number, w: any) => s + (w.amount || 0), 0);
        paidOffset += batchSize;
        if (paidBatch.length < batchSize) paidMore = false;
      } else paidMore = false;
    }
    
    // Total ad views - batch (sum of task_watch_ad from all users)
    let totalAdViews = 0;
    let adOffset = 0;
    let adMore = true;
    while (adMore) {
      const { data: adBatch } = await supabase.from("users").select("task_watch_ad").range(adOffset, adOffset + batchSize - 1);
      if (adBatch && adBatch.length > 0) {
        totalAdViews += adBatch.reduce((s: number, u: any) => s + (u.task_watch_ad || 0), 0);
        adOffset += batchSize;
        if (adBatch.length < batchSize) adMore = false;
      } else adMore = false;
    }
    
    const todayAds = dailyStatsRes.data?.ads_watched || 0;
    
    const msg = `📊 <b>Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${(totalUsersRes.count || 0).toLocaleString()}</b>\n` +
      `🆕 Bugun qo'shilgan: <b>${todayUsersRes.count || 0}</b>\n` +
      `💰 Tizimdagi tangalar: <b>${totalCoins.toLocaleString()}</b>\n\n` +
      `📺 <b>Reklama</b>\n` +
      `📺 Jami ko'rishlar: <b>${totalAdViews.toLocaleString()}</b>\n` +
      `📺 Bugungi ko'rishlar: <b>${todayAds}</b>\n\n` +
      `📤 <b>Pul yechish</b>\n` +
      `⏳ Kutilmoqda: <b>${pendingRes.count || 0}</b>\n` +
      `✅ Tasdiqlangan: <b>${approvedRes.count || 0}</b>\n` +
      `💸 Jami to'langan: <b>${totalPaid.toLocaleString()} tanga</b>\n\n` +
      `👥 Jami referallar: <b>${(totalReferralsRes.count || 0).toLocaleString()}</b>\n` +
      `🎮 Bugungi o'yinlar: <b>${todayGamesRes.count || 0}</b>`;
    
    await sendTelegramMessage(userId, msg);
  } catch (err) {
    console.error("[ADMIN] Stats error:", err);
    await sendTelegramMessage(userId, "❌ Statistikani olishda xatolik");
  }
}

async function handleBroadcastStart(message: any) {
  const userId = message.from.id;
  if (String(userId) !== String(TELEGRAM_ADMIN_ID)) return;
  
  adminStates.set(userId, "waiting_broadcast");
  console.log(`[ADMIN] Broadcast mode started by ${userId}`);
  
  const keyboard = {
    keyboard: [
      [{ text: "❌ Bekor qilish" }],
    ],
    resize_keyboard: true,
  };
  
  await sendTelegramMessage(userId, "📨 <b>Xabar yuborish</b>\n\n✏️ Endi xabar matnini yuboring.\n\n📷 Rasm bilan yuborishingiz ham mumkin (rasmga caption yozing).\n\n❌ Bekor qilish uchun tugmani bosing.", keyboard);
}

async function handleBroadcastMessage(message: any) {
  const userId = message.from.id;
  
  console.log(`[BROADCAST] Processing broadcast from admin ${userId}`);
  
  // Clear state
  adminStates.delete(userId);
  
  // Get all users
  let allUsers: any[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: batch } = await supabase
      .from("users")
      .select("telegram_id")
      .eq("is_blocked", false)
      .range(offset, offset + batchSize - 1);
    if (batch && batch.length > 0) {
      allUsers = allUsers.concat(batch);
      offset += batchSize;
      if (batch.length < batchSize) hasMore = false;
    } else hasMore = false;
  }
  
  const total = allUsers.length;
  await sendTelegramMessage(userId, `📤 Xabar ${total} ta foydalanuvchiga yuborilmoqda...`);
  
  let sent = 0;
  let failed = 0;
  
  const hasPhoto = message.photo && message.photo.length > 0;
  const caption = message.caption || "";
  const text = message.text || "";
  const photoFileId = hasPhoto ? message.photo[message.photo.length - 1].file_id : null;
  
  for (const user of allUsers) {
    try {
      if (hasPhoto && photoFileId) {
        await sendTelegramPhoto(user.telegram_id, photoFileId, caption);
      } else if (text) {
        await sendTelegramMessage(user.telegram_id, text);
      }
      sent++;
    } catch (e) {
      failed++;
    }
    // Small delay to avoid rate limiting
    if (sent % 30 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Restore admin keyboard
  const keyboard = {
    keyboard: [
      [{ text: "📨 Xabar yuborish" }, { text: "📊 Statistika" }],
      [{ text: "❌ Admin panelni yopish" }],
    ],
    resize_keyboard: true,
  };
  
  await sendTelegramMessage(userId, `✅ <b>Xabar yuborildi!</b>\n\n📤 Yuborildi: ${sent}\n❌ Xato: ${failed}\n📊 Jami: ${total}`, keyboard);
  console.log(`[BROADCAST] Done: sent=${sent}, failed=${failed}, total=${total}`);
}

async function handleCancelBroadcast(message: any) {
  const userId = message.from.id;
  adminStates.delete(userId);
  
  const keyboard = {
    keyboard: [
      [{ text: "📨 Xabar yuborish" }, { text: "📊 Statistika" }],
      [{ text: "❌ Admin panelni yopish" }],
    ],
    resize_keyboard: true,
  };
  
  await sendTelegramMessage(userId, "❌ Xabar yuborish bekor qilindi.", keyboard);
}

async function handleCloseAdmin(message: any) {
  const userId = message.from.id;
  adminStates.delete(userId);
  
  // Remove reply keyboard
  const removeKeyboard = { remove_keyboard: true };
  await sendTelegramMessage(userId, "✅ Admin panel yopildi.", removeKeyboard);
}

// ============ EXISTING FUNCTIONS ============

async function handleUsersCommand(message: any) {
  const adminId = message.from.id;
  const configuredAdminId = TELEGRAM_ADMIN_ID;
  
  console.log(`[USERS] Received /users command from ${adminId}, configured admin ID: "${configuredAdminId}"`);
  
  if (String(adminId) !== String(configuredAdminId)) {
    console.log(`[USERS] Unauthorized access attempt by ${adminId}`);
    await sendTelegramMessage(adminId, "⛔ Sizda admin huquqi yo'q");
    return;
  }
  
  console.log(`[USERS] Admin ${adminId} requesting users list`);
  
  try {
    const { count: totalCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    
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
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());
    
    let totalCoins = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: coinsBatch } = await supabase.from("users").select("coins").range(offset, offset + batchSize - 1);
      if (coinsBatch && coinsBatch.length > 0) {
        totalCoins += coinsBatch.reduce((sum: number, u: any) => sum + (u.coins || 0), 0);
        offset += batchSize;
        if (coinsBatch.length < batchSize) hasMore = false;
      } else hasMore = false;
    }
    
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
  
  const MINI_APP_URL = "https://691c729b6ca6a.xvest3.ru";
  const SUPPORT_BOT_URL = "https://t.me/Xakimovsupport_bot";
  const REQUIRED_CHANNEL = "@LuckyGame_uz";
  
  const text = message.text || "";
  let refTelegramId: string | null = null;
  
  if (text.includes("ref_")) {
    const refId = text.split("ref_")[1]?.split(" ")[0];
    if (refId && refId !== String(telegramId)) {
      refTelegramId = refId;
      console.log(`[REFERRAL] Found referral telegram_id: ${refTelegramId}`);
    }
  }
  
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  
  const isSubscribed = await checkChannelSubscription(telegramId, REQUIRED_CHANNEL);
  
  if (!isSubscribed) {
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
  
  if (referredBy && referrerTelegramId) {
    await processReferralReward(referredBy, referrerTelegramId, newUser.id, firstName);
  }
  
  await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
}

async function processReferralReward(referrerId: string, referrerTelegramId: number, newUserId: string, newUserName: string) {
  console.log(`[REFERRAL] Processing referral reward for referrer ${referrerId}`);
  
  const { error: refError } = await supabase.from("referrals").insert({
    referrer_id: referrerId,
    referred_id: newUserId,
  });
  
  if (refError) {
    console.error("[REFERRAL] Error creating referral record:", refError);
  } else {
    console.log("[REFERRAL] Referral record created");
  }
  
  const { data: referrerData } = await supabase
    .from("users")
    .select("coins, referral_count, task_invite_friend, last_task_reset")
    .eq("id", referrerId)
    .single();
  
  if (referrerData) {
    const profileReward = 50;
    const newReferralCount = referrerData.referral_count + 1;
    
    console.log(`[REFERRAL] Referrer current stats - coins: ${referrerData.coins}, referral_count: ${referrerData.referral_count}, task_invite_friend: ${referrerData.task_invite_friend}`);
    
    const now = new Date();
    const currentHour = now.getHours();
    const resetHours = [0, 6, 12, 18];
    
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
    
    let currentTaskCount = referrerData.task_invite_friend;
    if (shouldResetTasks) {
      currentTaskCount = 0;
      console.log(`[REFERRAL] Task reset triggered for referrer (6-hour period)`);
    }
    
    const newTaskCount = Math.min(currentTaskCount + 1, 2);
    
    let totalReward = profileReward;
    let taskBonusGiven = false;
    
    if (newTaskCount === 2 && currentTaskCount < 2) {
      totalReward += 100;
      taskBonusGiven = true;
      console.log(`[REFERRAL] Task bonus triggered! +100 coins`);
    }
    
    const updateData: any = { 
      coins: referrerData.coins + totalReward,
      referral_count: newReferralCount,
      task_invite_friend: newTaskCount
    };
    
    if (shouldResetTasks) {
      updateData.last_task_reset = now.toISOString();
      updateData.task_watch_ad = 0;
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
  
  const parts = data.split("_");
  const refTelegramIdStr = parts[3] !== 'none' ? parts[3] : null;
  
  const isSubscribed = await checkChannelSubscription(telegramId, REQUIRED_CHANNEL);
  
  if (!isSubscribed) {
    console.log(`[SUBSCRIPTION CHECK] User ${telegramId} still not subscribed`);
    await sendTelegramMessage(telegramId, "❌ Siz hali kanalga obuna bo'lmagansiz!\n\n📢 Iltimos, avval kanalga obuna bo'ling va qaytadan tekshiring.");
    return;
  }
  
  console.log(`[SUBSCRIPTION CHECK] User ${telegramId} is now subscribed!`);
  
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
    if (messageId) {
      await editTelegramMessage(telegramId, messageId, welcomeMessage, keyboard);
    } else {
      await sendTelegramMessage(telegramId, welcomeMessage, keyboard);
    }
    return;
  }
  
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
  
  if (referredBy && referrerTelegramId) {
    await processReferralReward(referredBy, referrerTelegramId, newUser.id, firstName);
  }
  
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
  
  if (withdrawal.user) {
    await sendTelegramMessage(withdrawal.user.telegram_id, userMessage);
    console.log(`[WITHDRAWAL] User ${withdrawal.user.telegram_id} notified`);
  }
  
  const updatedMessage = `${statusEmoji} <b>Pul yechish so'rovi - ${statusText}</b>\n\n` +
    `👤 Foydalanuvchi: ${withdrawal.user?.first_name || ''} ${withdrawal.user?.last_name || ''}\n` +
    `📱 Username: @${withdrawal.user?.username || "yo'q"}\n` +
    `🆔 Telegram ID: ${withdrawal.user?.telegram_id}\n` +
    `💵 Miqdor: ${withdrawal.amount} tanga\n` +
    `📍 Hamyon: ${withdrawal.wallet_address || "ko'rsatilmagan"}\n` +
    `✅ Holat: ${statusText}`;
  
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
  
  const rulesText = 
    "📕 <b>O'yin qoidalari va foydalanish shartlari</b>\n\n" +
    "🎲 <b>Lotoreya</b>\n" +
    "• Har 15 daqiqada avtomatik qur'a o'tkaziladi\n" +
    "• 1 dan 42 gacha 7 ta raqam tanlanadi\n" +
    "• Har bir ishtirok uchun 1 ta reklama ko'rish talab qilinadi\n" +
    "• Mos kelgan raqamlar soniga qarab mukofot beriladi\n" +
    "• Natijalar avtomatik tizim orqali aniqlanadi\n\n" +
    "💰 <b>Tanga ishlash yo'llari</b>\n" +
    "• Reklama ko'rish (har 6 soatda yangilanadi)\n" +
    "• Do'stlarni taklif qilish (+50 tanga)\n" +
    "• Hamkor kanallarga obuna bo'lish\n" +
    "• G'ildirak aylantirish\n" +
    "• AR o'yinlarda ishtirok etish\n" +
    "• Maxsus aksiyalar va bonus dasturlari\n\n" +
    "💸 <b>Pul yechish</b>\n" +
    "• Minimal yechish miqdori: 10 000 tanga\n" +
    "• 10 000 tanga = 17 000 so'm\n" +
    "• Pul yechish uchun 16 xonali karta raqami kiritish majburiy\n" +
    "• So'rovlar 1-14 ish kuni ichida ko'rib chiqiladi\n" +
    "• To'lovlar hamkor kompaniyalardan mablag' kelib tushishiga qarab amalga oshiriladi\n" +
    "• Tekshiruv jarayoni sababli to'lov muddati uzayishi mumkin\n\n" +
    "👥 <b>Referal tizimi</b>\n" +
    "• Har bir taklif qilingan do'st uchun: 50 tanga\n" +
    "• Yangi foydalanuvchiga: 300 tanga bonus\n" +
    "• Bonus do'st kanalga obuna bo'lgandan so'ng hisoblanadi\n" +
    "• Soxta akkauntlar aniqlansa, bonuslar bekor qilinadi\n\n" +
    "⚖️ <b>Qo'shimcha qoidalar</b>\n" +
    "• Bir nechta akkaunt ochish taqiqlanadi\n" +
    "• Qoidalarni buzgan foydalanuvchi bloklanishi mumkin\n" +
    "• Platforma qoidalarni o'zgartirish huquqini saqlab qoladi";
  
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

// ============ MAIN HANDLER ============

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
      const caption = message.caption || "";
      const userId = message.from.id;
      const isAdmin = String(userId) === String(TELEGRAM_ADMIN_ID);
      
      // Check if admin is in broadcast mode
      if (isAdmin && adminStates.get(userId) === "waiting_broadcast") {
        if (text === "❌ Bekor qilish") {
          await handleCancelBroadcast(message);
        } else {
          // Any text or photo message = broadcast
          await handleBroadcastMessage(message);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Admin reply keyboard buttons
      if (isAdmin) {
        if (text === "📨 Xabar yuborish") {
          await handleBroadcastStart(message);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (text === "📊 Statistika") {
          await handleAdminStats(message);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (text === "❌ Admin panelni yopish") {
          await handleCloseAdmin(message);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      // Commands
      if (text.startsWith("/start")) {
        await handleStart(message);
      } else if (text === "/users") {
        await handleUsersCommand(message);
      } else if (text === "/admin") {
        await handleAdminCommand(message);
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
