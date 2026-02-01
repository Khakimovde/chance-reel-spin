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
    const { telegramId, channelUsername } = await req.json();

    if (!telegramId) {
      return new Response(JSON.stringify({ error: "Missing telegramId", subscribed: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use provided channel username or default
    const channel = channelUsername || "@LotteryChannel";
    
    // Ensure channel username starts with @
    const formattedChannel = channel.startsWith('@') ? channel : `@${channel}`;

    console.log(`Checking subscription for user ${telegramId} in channel ${formattedChannel}`);

    // Check if user is a member of the channel
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(formattedChannel)}&user_id=${telegramId}`
    );

    const data = await response.json();
    console.log("Telegram API response:", JSON.stringify(data));

    if (!data.ok) {
      console.log("Telegram API error:", data.description);
      
      // Provide more specific error messages
      let errorMessage = data.description;
      if (data.error_code === 400 && data.description?.includes("chat not found")) {
        errorMessage = "Kanal topilmadi. Admin botni kanalga qo'shishi kerak.";
      } else if (data.error_code === 400 && data.description?.includes("user not found")) {
        errorMessage = "Foydalanuvchi topilmadi";
      } else if (data.error_code === 403) {
        errorMessage = "Bot kanaldan chiqarilgan yoki bloklangan";
      } else if (data.error_code === 404) {
        errorMessage = "Bot kanalga admin sifatida qo'shilmagan. Iltimos, botni (@Luckygame_robot) kanalga admin qilib qo'shing.";
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        error: errorMessage,
        errorCode: data.error_code
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = data.result?.status;
    // Include "left" check - if user left the channel
    const isSubscribed = ["member", "administrator", "creator"].includes(status);

    console.log(`User ${telegramId} subscription status in ${formattedChannel}: ${status}, isSubscribed: ${isSubscribed}`);

    return new Response(JSON.stringify({ 
      subscribed: isSubscribed, 
      status,
      message: isSubscribed ? "Obuna tasdiqlandi" : "Kanalga obuna bo'lmagan" 
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
