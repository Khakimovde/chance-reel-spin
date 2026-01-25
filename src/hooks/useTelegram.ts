import { useState, useEffect, useCallback, useRef } from 'react';
import { getTelegramUser, initTelegramApp, type TelegramUser } from '@/lib/telegram';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/gameStore';

export interface UserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  // Backend data
  coins: number;
  tickets: number;
  referral_count: number;
  total_winnings: number;
  referral_code?: string;
}

export const useTelegram = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const didInitRef = useRef(false);
  const syncWithBackend = useGameStore((s) => s.syncWithBackend);

  const getLocalFallback = () => {
    const state = useGameStore.getState();
    return {
      coins: state.coins,
      tickets: 0,
      referral_count: state.referralCount,
      total_winnings: state.totalWinnings,
    };
  };

  const syncUserData = useCallback(async (telegramUser: TelegramUser) => {
    try {
      // Sync user with backend
      const { data, error } = await supabase.functions.invoke('sync-user', {
        body: {
          telegramId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url,
        }
      });

      if (error) {
        console.error('Error syncing user:', error);
        // Use local data as fallback
        const local = getLocalFallback();
        setUser({
          ...telegramUser,
          coins: local.coins,
          tickets: local.tickets,
          referral_count: local.referral_count,
          total_winnings: local.total_winnings,
        });
        return;
      }

      if (data?.user) {
        const userData: UserData = {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
          photo_url: telegramUser.photo_url,
          language_code: telegramUser.language_code,
          coins: data.user.coins,
          tickets: data.user.tickets,
          referral_count: data.user.referral_count,
          total_winnings: data.user.total_winnings,
          referral_code: data.user.referral_code,
        };
        setUser(userData);
        
        // Sync local store with backend data
        syncWithBackend(
          data.user.coins,
          data.user.tickets,
          data.user.referral_count,
          data.user.total_winnings
        );
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      // Use local data as fallback
      const telegramUser = getTelegramUser();
      if (telegramUser) {
        const local = getLocalFallback();
        setUser({
          ...telegramUser,
          coins: local.coins,
          tickets: local.tickets,
          referral_count: local.referral_count,
          total_winnings: local.total_winnings,
        });
      }
    }
  }, [syncWithBackend]);

  const refreshUserData = useCallback(async () => {
    const telegramUser = getTelegramUser();
    if (telegramUser) {
      await syncUserData(telegramUser);
    }
  }, [syncUserData]);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const init = async () => {
      initTelegramApp();
      const telegramUser = getTelegramUser();
      
      if (telegramUser) {
        await syncUserData(telegramUser);
      }
      
      setIsLoading(false);
    };

    init();
  }, [syncUserData]);

  return { user, isLoading, refreshUserData };
};
