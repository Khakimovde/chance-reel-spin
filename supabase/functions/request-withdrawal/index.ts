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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { telegramId, amount, walletAddress } = await req.json();
    
    if (!telegramId || !amount) {
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
    
    // Check balance
    if (user.total_winnings < amount) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Create withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount,
        wallet_address: walletAddress || null,
        status: "pending",
      })
      .select()
      .single();
    
    if (withdrawalError) {
      console.error("Withdrawal error:", withdrawalError);
      return new Response(JSON.stringify({ error: "Failed to create withdrawal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Deduct from user's total winnings
    await supabase
      .from("users")
      .update({ total_winnings: user.total_winnings - amount })
      .eq("id", user.id);
    
    // Notify admin
    const adminMessage = `💰 <b>Yangi pul yechish so'rovi!</b>\n\n` +
      `👤 Foydalanuvchi: ${user.first_name} ${user.last_name || ""}\n` +
      `📱 Username: @${user.username || "yo'q"}\n` +
      `🆔 Telegram ID: ${user.telegram_id}\n` +
      `💵 Miqdor: ${amount} tanga\n` +
      `📍 Hamyon: ${walletAddress || "ko'rsatilmagan"}\n` +
      `🕐 Vaqt: ${new Date().toLocaleString("uz-UZ")}`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Qabul qilish", callback_data: `approve_${withdrawal.id}` },
          { text: "❌ Rad etish", callback_data: `reject_${withdrawal.id}` },
        ],
        [
          { text: "💰 To'lash", callback_data: `pay_${withdrawal.id}` },
        ],
      ],
    };
    
    await sendTelegramMessage(TELEGRAM_ADMIN_ID, adminMessage, keyboard);
    
    // Notify user
    await sendTelegramMessage(
      telegramId,
      `📤 <b>Pul yechish so'rovi yuborildi!</b>\n\n💵 Miqdor: ${amount} tanga\n\nSo'rov ko'rib chiqilmoqda. Natija haqida xabar beramiz.`
    );
    
    return new Response(JSON.stringify({ 
      success: true, 
      withdrawal: withdrawal,
      message: "So'rov yuborildi" 
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
