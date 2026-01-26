-- Add daily statistics tracking table
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  ads_watched integer NOT NULL DEFAULT 0,
  new_users integer NOT NULL DEFAULT 0,
  wheel_spins integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access for all
CREATE POLICY "Anyone can read daily stats" ON public.daily_stats
FOR SELECT USING (true);

-- Allow insert/update for system
CREATE POLICY "System can manage daily stats" ON public.daily_stats
FOR ALL USING (true);

-- Add total_winnings column to track returned coins on rejection
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON public.daily_stats(date);