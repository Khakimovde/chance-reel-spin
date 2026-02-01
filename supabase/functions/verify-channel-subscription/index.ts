import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId, channelUsername, testBot } = await req.json();

    // Test bot connectivity first
    if (testBot) {
      console.log("Testing bot connectivity...");
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      const botInfo = await botInfoResponse.json();
      console.log("Bot info response:", JSON.stringify(botInfo));
      
      return new Response(JSON.stringify({ 
        botInfo,
        tokenPresent: !!TELEGRAM_BOT_TOKEN,
        tokenLength: TELEGRAM_BOT_TOKEN?.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!telegramId) {
      return new Response(JSON.stringify({ error: "Missing telegramId", subscribed: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use provided channel username or default
    let channel = channelUsername || "@LotteryChannel";
    
    // Ensure channel username starts with @
    if (!channel.startsWith('@')) {
      channel = `@${channel}`;
    }

    console.log(`Checking subscription for user ${telegramId} in channel ${channel}`);

    // First verify the bot is working
    const botCheckResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const botCheck = await botCheckResponse.json();
    
    if (!botCheck.ok) {
      console.error("Bot token is invalid:", botCheck);
      return new Response(JSON.stringify({ 
        subscribed: false, 
        error: "Bot tokeni noto'g'ri yoki yaroqsiz",
        botError: botCheck.description
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Bot verified: @${botCheck.result.username} (${botCheck.result.first_name})`);

    // Check if user is a member of the channel
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${telegramId}`;
    console.log(`Calling Telegram API for channel: ${channel}, user: ${telegramId}`);

    const response = await fetch(telegramUrl);
    const data = await response.json();
    
    console.log("Telegram API response:", JSON.stringify(data));

    if (!data.ok) {
      console.log("Telegram API error:", data.description, "Error code:", data.error_code);
      
      // Provide more specific error messages based on error
      let errorMessage = data.description || "Unknown error";
      
      if (data.description?.includes("chat not found")) {
        errorMessage = `Kanal "${channel}" topilmadi. Kanal username to'g'ri ekanligini tekshiring.`;
      } else if (data.description?.includes("user not found")) {
        errorMessage = "Foydalanuvchi Telegram'da topilmadi";
      } else if (data.description?.includes("PARTICIPANT_ID_INVALID")) {
        errorMessage = "Foydalanuvchi ID noto'g'ri";
      } else if (data.description?.includes("member list is inaccessible")) {
        errorMessage = `Bot ${channel} kanaliga admin sifatida qo'shilmagan. Botni (@${botCheck.result.username}) kanalga admin qilib qo'shing.`;
      } else if (data.description?.includes("CHAT_ADMIN_REQUIRED")) {
        errorMessage = `Bot ${channel} kanalda admin emas. Botni (@${botCheck.result.username}) kanalga admin qilib qo'shing.`;
      } else if (data.error_code === 403) {
        errorMessage = "Bot kanaldan chiqarilgan yoki bloklangan";
      } else if (data.error_code === 400 && data.description?.includes("Bad Request")) {
        errorMessage = `Kanal "${channel}" topilmadi yoki bot bu kanalga kirish huquqiga ega emas.`;
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        error: errorMessage,
        errorCode: data.error_code,
        rawError: data.description,
        botUsername: botCheck.result.username
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = data.result?.status;
    console.log(`User ${telegramId} status in ${channel}: ${status}`);
    
    // User is subscribed if they are member, administrator, or creator
    // "left" and "kicked" mean they are NOT subscribed
    const isSubscribed = ["member", "administrator", "creator"].includes(status);

    console.log(`User ${telegramId} subscription status: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);

    return new Response(JSON.stringify({ 
      subscribed: isSubscribed, 
      status,
      message: isSubscribed ? "Obuna tasdiqlandi" : `Kanalga obuna bo'lmagan (status: ${status})`,
      botUsername: botCheck.result.username
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", err);
    return new Response(JSON.stringify({ subscribed: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
