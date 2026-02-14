import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Participant {
  id: string;
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

const getAvatar = (p: Participant) =>
  p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name || p.telegram_id}`;
const getName = (p: Participant) => p.first_name || p.username || `User ${p.telegram_id}`;

export const BattleResults = ({ round, participants }: { round: BattleRound; participants: Participant[] }) => {
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [showAllLosers, setShowAllLosers] = useState(false);

  const winners = participants.filter(p => p.is_winner);
  const losers = participants.filter(p => !p.is_winner);
  const displayWinners = showAllWinners ? winners : winners.slice(0, 10);
  const displayLosers = showAllLosers ? losers : losers.slice(0, 10);

  if (participants.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border/30 p-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="w-3.5 h-3.5 text-white" />
          </div>
          Oxirgi raund natijalari
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-200/30 p-3 text-center">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-2xl font-black text-emerald-600">{winners.length}</p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">G'oliblar (+20 🪙)</p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-200/30 p-3 text-center">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-2xl font-black text-red-500">{losers.length}</p>
            <p className="text-[10px] text-red-500 font-semibold mt-0.5">Yutqizganlar (+10 🪙)</p>
          </div>
        </div>

        {/* Winners */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" /> G'oliblar ro'yxati
          </p>
          <div className="space-y-1.5">
            {displayWinners.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/30"
              >
                <img src={getAvatar(p)} alt="" className="w-9 h-9 rounded-full ring-2 ring-emerald-400 shadow-sm" />
                <span className="text-sm font-medium flex-1 truncate">{getName(p)}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">+20 🪙</span>
              </motion.div>
            ))}
          </div>
          {winners.length > 10 && (
            <button onClick={() => setShowAllWinners(!showAllWinners)} className="w-full text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1 py-1.5">
              {showAllWinners ? <><ChevronUp className="w-3 h-3" /> Yopish</> : <><ChevronDown className="w-3 h-3" /> Barchasi ({winners.length})</>}
            </button>
          )}
        </div>

        {/* Losers */}
        {losers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Yutqizganlar ({losers.length} kishi)
            </p>
            <div className="space-y-1.5">
              {displayLosers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/30"
                >
                  <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full ring-1 ring-red-300 opacity-80" />
                  <span className="text-sm font-medium flex-1 truncate text-muted-foreground">{getName(p)}</span>
                  <span className="text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">+10 🪙</span>
                </motion.div>
              ))}
            </div>
            {losers.length > 10 && (
              <button onClick={() => setShowAllLosers(!showAllLosers)} className="w-full text-xs font-semibold text-red-500 flex items-center justify-center gap-1 py-1.5">
                {showAllLosers ? <><ChevronUp className="w-3 h-3" /> Yopish</> : <><ChevronDown className="w-3 h-3" /> Barchasi ({losers.length})</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
