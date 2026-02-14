import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WINNER_PERCENT = 0.50;
const WINNER_REWARD = 20;
const LOSER_REWARD = 40;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find rounds that should be processed (round_time has passed, status is waiting)
    const now = new Date().toISOString();
    const { data: rounds } = await supabase
      .from('battle_rounds')
      .select('*')
      .eq('status', 'waiting')
      .lte('round_time', now);

    if (!rounds || rounds.length === 0) {
      return new Response(JSON.stringify({ message: 'No rounds to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const round of rounds) {
      // Get all participants
      const { data: participants } = await supabase
        .from('battle_participants')
        .select('*')
        .eq('round_id', round.id);

      if (!participants || participants.length === 0) {
        // No participants, mark as completed
        await supabase
          .from('battle_rounds')
          .update({ status: 'completed', processed_at: now })
          .eq('id', round.id);
        continue;
      }

      // Select 15% as winners (minimum 1 if there are participants)
      const winnerCount = Math.max(1, Math.round(participants.length * WINNER_PERCENT));
      
      // Shuffle and pick winners
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const winners = new Set(shuffled.slice(0, winnerCount).map(p => p.id));

      // Update each participant
      for (const p of participants) {
        const isWinner = winners.has(p.id);
        const reward = isWinner ? WINNER_REWARD : LOSER_REWARD;

        await supabase
          .from('battle_participants')
          .update({ is_winner: isWinner, reward })
          .eq('id', p.id);

        // Add coins to user
        const { data: user } = await supabase
          .from('users')
          .select('coins')
          .eq('id', p.user_id)
          .single();

        if (user) {
          await supabase
            .from('users')
            .update({ coins: user.coins + reward })
            .eq('id', p.user_id);
        }
      }

      // Mark round as completed
      await supabase
        .from('battle_rounds')
        .update({
          status: 'completed',
          total_winners: winnerCount,
          processed_at: now,
        })
        .eq('id', round.id);

      results.push({ round_id: round.id, participants: participants.length, winners: winnerCount });
    }

    return new Response(JSON.stringify({ processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
