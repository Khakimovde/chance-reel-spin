import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Timer, Trophy, Users, ChevronDown, ChevronUp, Loader2, Crown, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramUser } from '@/lib/telegram';
import { showAd } from '@/lib/adService';
import { toast } from 'sonner';

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

function getNextRoundTime(): Date {
  const now = Date.now();
  return new Date(Math.ceil(now / BATTLE_INTERVAL) * BATTLE_INTERVAL);
}

function getTimeUntilNextRound(): number {
  return Math.max(0, getNextRoundTime().getTime() - Date.now());
}

function getCurrentRoundSlot(): string {
  const now = Date.now();
  const nextSlot = Math.ceil(now / BATTLE_INTERVAL) * BATTLE_INTERVAL;
  return `battle_${nextSlot}`;
}

function getPreviousRoundSlot(): string {
  const now = Date.now();
  const currentSlot = Math.floor(now / BATTLE_INTERVAL) * BATTLE_INTERVAL;
  return `battle_${currentSlot}`;
}

export const BattleTab = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 });
  const [currentRound, setCurrentRound] = useState<BattleRound | null>(null);
  const [lastRound, setLastRound] = useState<BattleRound | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lastParticipants, setLastParticipants] = useState<Participant[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAllLast, setShowAllLast] = useState(false);
  const [loading, setLoading] = useState(true);

  const telegramUser = getTelegramUser();

  // Timer
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

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const currentSlot = getCurrentRoundSlot();
      const prevSlot = getPreviousRoundSlot();

      // Fetch current and previous rounds in parallel
      const [currentRes, prevRes] = await Promise.all([
        supabase.from('battle_rounds').select('*').eq('round_slot', currentSlot).maybeSingle(),
        supabase.from('battle_rounds').select('*').eq('round_slot', prevSlot).maybeSingle(),
      ]);

      const cr = currentRes.data as BattleRound | null;
      const pr = prevRes.data as BattleRound | null;
      setCurrentRound(cr);
      setLastRound(pr);

      // Fetch participants for both rounds
      const promises: Array<Promise<unknown>> = [];
      if (cr) {
        promises.push(
          (supabase.from('battle_participants').select('*').eq('round_id', cr.id) as any).then((r: any) => {
            const parts = (r.data || []) as Participant[];
            setParticipants(parts);
            if (telegramUser) {
              setHasJoined(parts.some(p => p.telegram_id === telegramUser.id));
            }
          })
        );
      } else {
        setParticipants([]);
        setHasJoined(false);
      }

      if (pr && pr.status === 'completed') {
        promises.push(
          (supabase.from('battle_participants').select('*').eq('round_id', pr.id) as any).then((r: any) => {
            setLastParticipants((r.data || []) as Participant[]);
          })
        );
      }

      await Promise.all(promises);
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('battle-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_rounds' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleJoin = async () => {
    if (!telegramUser || hasJoined || joining) return;
    setJoining(true);
    try {
      toast.info('Reklama ko\'rilmoqda...');
      const adShown = await showAd();
      if (!adShown) {
        toast.error('Reklama ko\'rsatilmadi');
        return;
      }

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

  const getAvatar = (p: Participant) =>
    p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name || p.telegram_id}`;

  const getName = (p: Participant) => p.first_name || p.username || `User ${p.telegram_id}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const winners = lastParticipants.filter(p => p.is_winner);
  const losers = lastParticipants.filter(p => !p.is_winner);
  const displayParticipants = showAll ? participants : participants.slice(0, 10);
  const displayLastWinners = showAllLast ? winners : winners.slice(0, 10);

  return (
    <div className="pb-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-bold flex items-center justify-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          Battle Arena
        </h2>
        <p className="text-xs text-muted-foreground">Haqiqiy o'yinchilar bilan raqobatlashing!</p>
      </div>

      {/* Timer */}
      <div className="glass-card-elevated p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
            <Timer className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Keyingi raund</p>
            <p className="text-sm font-semibold">Har 30 daqiqada</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-muted rounded-xl px-3 py-2 min-w-[52px] text-center">
            <motion.span key={timeLeft.minutes} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-bold inline-block">
              {String(timeLeft.minutes).padStart(2, '0')}
            </motion.span>
            <span className="text-xs text-muted-foreground ml-0.5">d</span>
          </div>
          <motion.span className="text-2xl font-bold text-primary" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>:</motion.span>
          <div className="bg-muted rounded-xl px-3 py-2 min-w-[52px] text-center">
            <motion.span key={timeLeft.seconds} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-bold inline-block">
              {String(timeLeft.seconds).padStart(2, '0')}
            </motion.span>
            <span className="text-xs text-muted-foreground ml-0.5">s</span>
          </div>
        </div>
      </div>

      {/* Join Button */}
      <motion.button
        onClick={handleJoin}
        disabled={hasJoined || joining}
        className={`w-full py-3 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
          hasJoined
            ? 'bg-green-500 cursor-default'
            : 'bg-gradient-to-r from-red-500 to-orange-500 active:scale-[0.98]'
        } disabled:opacity-70`}
        whileTap={!hasJoined && !joining ? { scale: 0.97 } : undefined}
      >
        {joining ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : hasJoined ? (
          <>✅ Qo'shilgansiz</>
        ) : (
          <>⚔️ O'yinga qo'shilish</>
        )}
      </motion.button>

      {/* Current participants */}
      {participants.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Qatnashchilar ({participants.length})
            </h3>
          </div>
          <div className="space-y-2">
            {displayParticipants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-2 rounded-xl bg-muted/50"
              >
                <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full" />
                <span className="text-sm font-medium flex-1 truncate">{getName(p)}</span>
                <span className="text-xs text-muted-foreground">⚔️</span>
              </motion.div>
            ))}
          </div>
          {participants.length > 10 && (
            <button onClick={() => setShowAll(!showAll)} className="w-full text-xs text-primary font-medium flex items-center justify-center gap-1 pt-1">
              {showAll ? <><ChevronUp className="w-3 h-3" /> Yopish</> : <><ChevronDown className="w-3 h-3" /> Barchasini ko'rish ({participants.length})</>}
            </button>
          )}
        </div>
      )}

      {/* Last round results */}
      {lastRound?.status === 'completed' && lastParticipants.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Oxirgi raund natijalari
          </h3>

          {/* Stats */}
          <div className="flex gap-2">
            <div className="flex-1 bg-green-50 border border-green-200/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-600">{winners.length}</p>
              <p className="text-[10px] text-green-600 font-medium">G'oliblar (+23)</p>
            </div>
            <div className="flex-1 bg-red-50 border border-red-200/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-500">{losers.length}</p>
              <p className="text-[10px] text-red-500 font-medium">Yutqizganlar (+7)</p>
            </div>
          </div>

          {/* Winners list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
              <Crown className="w-3 h-3" /> G'oliblar
            </p>
            {displayLastWinners.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-2 rounded-xl bg-green-50/80 border border-green-200/30"
              >
                <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full ring-2 ring-green-400" />
                <span className="text-sm font-medium flex-1 truncate">{getName(p)}</span>
                <span className="text-xs font-bold text-green-600">+{p.reward} 🪙</span>
              </motion.div>
            ))}
            {winners.length > 10 && (
              <button onClick={() => setShowAllLast(!showAllLast)} className="w-full text-xs text-primary font-medium flex items-center justify-center gap-1">
                {showAllLast ? <><ChevronUp className="w-3 h-3" /> Yopish</> : <><ChevronDown className="w-3 h-3" /> Barchasini ko'rish ({winners.length})</>}
              </button>
            )}
          </div>

          {/* Losers summary */}
          {losers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Yutqizganlar ({losers.length} kishi, har biri +7 🪙)
              </p>
              <div className="flex flex-wrap gap-1">
                {losers.slice(0, 20).map(p => (
                  <img key={p.id} src={getAvatar(p)} alt="" className="w-7 h-7 rounded-full ring-1 ring-red-300 opacity-70" title={getName(p)} />
                ))}
                {losers.length > 20 && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground font-bold">
                    +{losers.length - 20}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
