import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramUser } from '@/lib/telegram';
import { showAd } from '@/lib/adService';
import { toast } from 'sonner';
import { BattleTimer } from './battle/BattleTimer';
import { BattleParticipants } from './battle/BattleParticipants';
import { BattleResultModal } from './battle/BattleResultModal';
import { BattleHistory } from './battle/BattleHistory';
import { BattleSelectionAnimation } from './battle/BattleSelectionAnimation';

const BATTLE_INTERVAL = 30 * 60 * 1000;

interface Participant {
  id: string;
  user_id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  is_winner: boolean;
  reward: number;
}

interface BattleRound {
  id: string;
  round_slot: string;
  round_time: string;
  status: string;
  total_participants: number;
  total_winners: number;
}

function getTimeUntilNextRound(): number {
  const now = Date.now();
  const next = Math.ceil(now / BATTLE_INTERVAL) * BATTLE_INTERVAL;
  return Math.max(0, next - now);
}

function getCurrentRoundSlot(): string {
  return `battle_${Math.ceil(Date.now() / BATTLE_INTERVAL) * BATTLE_INTERVAL}`;
}

function getPreviousRoundSlot(): string {
  return `battle_${Math.floor(Date.now() / BATTLE_INTERVAL) * BATTLE_INTERVAL}`;
}

export const BattleTab = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 });
  const [currentRound, setCurrentRound] = useState<BattleRound | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSelection, setShowSelection] = useState(false);
  const [selectionParticipants, setSelectionParticipants] = useState<Participant[]>([]);
  const [resultModal, setResultModal] = useState<{ open: boolean; isWinner: boolean; reward: number }>({
    open: false, isWinner: false, reward: 0
  });

  const telegramUser = getTelegramUser();

  useEffect(() => {
    const update = () => {
      const diff = getTimeUntilNextRound();
      setTimeLeft({
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const currentSlot = getCurrentRoundSlot();
      const prevSlot = getPreviousRoundSlot();

      const [currentRes, prevRes] = await Promise.all([
        supabase.from('battle_rounds').select('*').eq('round_slot', currentSlot).maybeSingle(),
        supabase.from('battle_rounds').select('*').eq('round_slot', prevSlot).maybeSingle(),
      ]);

      const cr = currentRes.data as BattleRound | null;
      const pr = prevRes.data as BattleRound | null;
      setCurrentRound(cr);

      if (cr) {
        const { data } = await supabase.from('battle_participants').select('*').eq('round_id', cr.id);
        const parts = (data || []) as Participant[];
        setParticipants(parts);
        if (telegramUser) {
          setHasJoined(parts.some(p => p.telegram_id === telegramUser.id));
        }
      } else {
        setParticipants([]);
        setHasJoined(false);
      }

      // Check last round for result modal + selection animation
      if (pr && pr.status === 'completed' && telegramUser) {
        const { data: lastParts } = await supabase.from('battle_participants').select('*').eq('round_id', pr.id);
        const lp = (lastParts || []) as Participant[];
        const myResult = lp.find(p => p.telegram_id === telegramUser.id);
        if (myResult && !resultModal.open && !showSelection) {
          setSelectionParticipants(lp);
          setShowSelection(true);
        }
      }
    } catch (err) {
      console.error('Battle fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [telegramUser]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('battle-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_rounds' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleSelectionComplete = () => {
    setShowSelection(false);
    if (telegramUser && selectionParticipants.length > 0) {
      const myResult = selectionParticipants.find(p => p.telegram_id === telegramUser.id);
      if (myResult) {
        setResultModal({ open: true, isWinner: myResult.is_winner, reward: myResult.reward });
      }
    }
  };

  const handleJoin = async () => {
    if (!telegramUser || hasJoined || joining) return;
    setJoining(true);
    try {
      toast.info('Reklama ko\'rilmoqda...');
      const adShown = await showAd();
      if (!adShown) { toast.error('Reklama ko\'rsatilmadi'); return; }

      const res = await supabase.functions.invoke('battle-join', {
        body: { telegram_id: telegramUser.id },
      });

      if (res.error) throw res.error;
      const data = res.data;
      if (data?.error) {
        if (data.alreadyJoined) {
          toast.info('Siz allaqachon qo\'shilgansiz!');
          setHasJoined(true);
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success('O\'yinga qo\'shildingiz! ⚔️');
      setHasJoined(true);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Swords className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight">Battle Arena</h2>
            <p className="text-[10px] text-muted-foreground font-medium">Haqiqiy o'yinchilar bilan raqobatlashing!</p>
          </div>
        </div>
        <BattleHistory telegramId={telegramUser?.id} />
      </div>

      <BattleTimer minutes={timeLeft.minutes} seconds={timeLeft.seconds} />

      {/* Join Button */}
      <motion.button
        onClick={handleJoin}
        disabled={hasJoined || joining}
        className={`w-full py-3.5 rounded-2xl font-bold text-white shadow-xl flex items-center justify-center gap-2 transition-all ${
          hasJoined
            ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20'
            : 'bg-gradient-to-r from-red-500 to-orange-500 shadow-red-500/20 active:scale-[0.98]'
        } disabled:opacity-80`}
        whileTap={!hasJoined && !joining ? { scale: 0.97 } : undefined}
      >
        {joining ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : hasJoined ? (
          <span className="flex items-center gap-2">✅ Siz qo'shilgansiz</span>
        ) : (
          <span className="flex items-center gap-2">⚔️ O'yinga qo'shilish</span>
        )}
      </motion.button>

      <BattleParticipants participants={participants} />

      {/* Selection Animation */}
      <BattleSelectionAnimation
        participants={selectionParticipants}
        isOpen={showSelection}
        onComplete={handleSelectionComplete}
        myTelegramId={telegramUser?.id}
      />

      {/* Result modal */}
      <BattleResultModal
        isOpen={resultModal.open}
        isWinner={resultModal.isWinner}
        reward={resultModal.reward}
        onClose={() => setResultModal(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};