-- Add username and telegram_id columns to withdrawals table
-- These will store the user info at the time of withdrawal request

ALTER TABLE public.withdrawals 
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS telegram_id bigint,
ADD COLUMN IF NOT EXISTS first_name text;

-- Update existing pending withdrawals with user info
UPDATE public.withdrawals w
SET 
  username = u.username,
  telegram_id = u.telegram_id,
  first_name = u.first_name
FROM public.users u
WHERE w.user_id = u.id
AND w.username IS NULL;