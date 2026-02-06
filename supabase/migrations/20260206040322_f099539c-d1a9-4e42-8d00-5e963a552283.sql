-- Add game settings table for enabling/disabling games
CREATE TABLE IF NOT EXISTS public.game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text UNIQUE NOT NULL,
  game_name text NOT NULL,
  icon text NOT NULL DEFAULT '🎮',
  is_enabled boolean NOT NULL DEFAULT true,
  gradient text NOT NULL DEFAULT 'from-gray-400 to-gray-500',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add is_blocked column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Add app_settings table for configurable settings like min withdrawal
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default game settings
INSERT INTO public.game_settings (game_id, game_name, icon, is_enabled, gradient, description) VALUES
('wheel', 'G''ildirak', '🎡', true, 'from-amber-400 to-orange-500', 'Omadingizni sinab ko''ring!'),
('mines', 'Mines', '💣', true, 'from-red-400 to-rose-600', 'Bombalardan qoching!'),
('box', 'Sandiq', '🎁', true, 'from-purple-400 to-violet-600', '9 ta sandiqdan birini tanlang!')
ON CONFLICT (game_id) DO NOTHING;

-- Insert default app settings
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
('min_withdrawal', '5000', 'Minimal pul yechish miqdori (tanga)')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for game_settings
CREATE POLICY "Anyone can read game settings" ON public.game_settings FOR SELECT USING (true);
CREATE POLICY "System can manage game settings" ON public.game_settings FOR ALL USING (true);

-- RLS policies for app_settings  
CREATE POLICY "Anyone can read app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "System can manage app settings" ON public.app_settings FOR ALL USING (true);