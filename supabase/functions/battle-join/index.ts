import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATTLE_INTERVAL = 30 * 60 * 1000; // 30 minutes
const WINNER_PERCENT = 0.15;
const WINNER_REWARD = 23;
const LOSER_REWARD = 7;

function getCurrentRoundSlot(): { slot: string; time: Date } {
  const now = Date.now();
  const nextSlot = Math.ceil(now / BATTLE_INTERVAL) * BATTLE_INTERVAL;
  return { slot: `battle_${nextSlot}`, time: new Date(nextSlot) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { telegram_id } = await req.json();
    if (!telegram_id) {
      return new Response(JSON.stringify({ error: 'telegram_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, first_name, photo_url, telegram_id')
      .eq('telegram_id', telegram_id)
      .single();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create current round
    const { slot, time } = getCurrentRoundSlot();

    let { data: round } = await supabase
      .from('battle_rounds')
      .select('*')
      .eq('round_slot', slot)
      .single();

    if (!round) {
      const { data: newRound, error: createErr } = await supabase
        .from('battle_rounds')
        .insert({ round_slot: slot, round_time: time.toISOString(), status: 'waiting' })
        .select()
        .single();
      
      if (createErr) {
        // Might be race condition, try fetching again
        const { data: existing } = await supabase
          .from('battle_rounds')
          .select('*')
          .eq('round_slot', slot)
          .single();
        round = existing;
      } else {
        round = newRound;
      }
    }

    if (!round) {
      return new Response(JSON.stringify({ error: 'Could not get round' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (round.status !== 'waiting') {
      return new Response(JSON.stringify({ error: 'Round already processed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from('battle_participants')
      .select('id')
      .eq('round_id', round.id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Already joined', alreadyJoined: true }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Join the round
    await supabase.from('battle_participants').insert({
      round_id: round.id,
      user_id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      photo_url: user.photo_url,
    });

    // Update participant count
    await supabase
      .from('battle_rounds')
      .update({ total_participants: round.total_participants + 1 })
      .eq('id', round.id);

    return new Response(JSON.stringify({ success: true, round_id: round.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
