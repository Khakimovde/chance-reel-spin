-- Create required_channels table for admin-manageable channels
CREATE TABLE public.required_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_username TEXT NOT NULL UNIQUE,
  reward_amount INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.required_channels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can read active channels" ON public.required_channels
  FOR SELECT USING (is_active = true);

CREATE POLICY "System can manage channels" ON public.required_channels
  FOR ALL USING (true);

-- Add index for quick lookup
CREATE INDEX idx_required_channels_active ON public.required_channels(is_active);

-- Insert default channel
INSERT INTO public.required_channels (channel_username, reward_amount, is_active)
VALUES ('@LotteryChannel', 200, true);