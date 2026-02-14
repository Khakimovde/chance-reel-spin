
-- Battle rounds table
CREATE TABLE public.battle_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_slot TEXT NOT NULL UNIQUE,
  round_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  total_participants INTEGER NOT NULL DEFAULT 0,
  total_winners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.battle_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battle rounds" ON public.battle_rounds FOR SELECT USING (true);
CREATE POLICY "System can manage battle rounds" ON public.battle_rounds FOR ALL USING (true);

-- Battle participants table
CREATE TABLE public.battle_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.battle_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  telegram_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  photo_url TEXT,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  reward INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id)
);

ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battle participants" ON public.battle_participants FOR SELECT USING (true);
CREATE POLICY "System can manage battle participants" ON public.battle_participants FOR ALL USING (true);

-- Enable realtime for battle tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_participants;
