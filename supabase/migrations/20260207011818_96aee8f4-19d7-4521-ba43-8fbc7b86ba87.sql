
-- Add ad_reward_coins setting (how many coins for watching 10 ads)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('ad_reward_coins', '300', 'Tanga mukofoti 10 ta reklama ko''rish uchun')
ON CONFLICT (setting_key) DO NOTHING;

-- Add coin_to_som_rate setting (exchange rate)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('coin_to_som_rate', '2', '1 tanga necha so''m')
ON CONFLICT (setting_key) DO NOTHING;
