import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHANNEL_USERNAME = "@LotteryChannel"; // Can be made configurable via admin

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId } = await req.json();

    if (!telegramId) {
      return new Response(JSON.stringify({ error: "Missing telegramId", subscribed: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is a member of the channel
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL_USERNAME)}&user_id=${telegramId}`
    );

    const data = await response.json();
    console.log("Telegram API response:", data);

    if (!data.ok) {
      return new Response(JSON.stringify({ subscribed: false, error: data.description }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = data.result?.status;
    const isSubscribed = ["member", "administrator", "creator"].includes(status);

    return new Response(JSON.stringify({ subscribed: isSubscribed, status }), {
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
