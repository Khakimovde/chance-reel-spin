import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderUser {
  id: string;
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  photo_url: string | null;
  coins: number;
}

const PODIUM_COLORS = [
  { bg: 'from-amber-400 to-yellow-500', shadow: 'shadow-amber-400/30', ring: 'ring-amber-400/40', label: '🥇' },
  { bg: 'from-slate-300 to-slate-400', shadow: 'shadow-slate-400/30', ring: 'ring-slate-300/40', label: '🥈' },
  { bg: 'from-orange-400 to-amber-600', shadow: 'shadow-orange-400/30', ring: 'ring-orange-400/40', label: '🥉' },
];

export const LeaderboardTab = () => {
  const [leaders, setLeaders] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, telegram_id, first_name, username, photo_url, coins')
        .order('coins', { ascending: false })
        .limit(30);
      if (data) setLeaders(data);
      setLoading(false);
    };
    fetchLeaders();
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  // Reorder for podium display: [2nd, 1st, 3rd]
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ['h-24', 'h-32', 'h-20'];
  const podiumSizes = ['w-16 h-16', 'w-20 h-20', 'w-14 h-14'];
  const podiumTextSizes = ['text-sm', 'text-base', 'text-sm'];
  const podiumRanks = [1, 0, 2]; // index mapping for colors

  const getAvatar = (user: LeaderUser) =>
    user.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.first_name || user.telegram_id}`;

  const getDisplayName = (user: LeaderUser) =>
    user.first_name || (user.username ? `@${user.username}` : `ID: ${user.telegram_id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Trophy className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-black leading-tight">Lider Jadvali</h2>
          <p className="text-[10px] text-muted-foreground font-medium">Top 30 eng ko'p tangali o'yinchilar</p>
        </div>
      </div>

      {/* Podium - Top 3 */}
      {top3.length >= 3 && (
        <div className="glass-card-elevated p-4 pt-6">
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((user, i) => {
              const rankIdx = podiumRanks[i];
              const colors = PODIUM_COLORS[rankIdx];
              return (
                <motion.div
                  key={user.id}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15, type: 'spring', bounce: 0.3 }}
                >
                  {/* Crown for #1 */}
                  {rankIdx === 0 && (
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Crown className="w-6 h-6 text-amber-400 mb-1" />
                    </motion.div>
                  )}

                  {/* Avatar */}
                  <div className={`relative ${podiumSizes[i]} rounded-full ring-3 ${colors.ring} p-0.5`}>
                    <img
                      src={getAvatar(user)}
                      alt={getDisplayName(user)}
                      className="w-full h-full rounded-full object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 text-lg">{colors.label}</div>
                  </div>

                  {/* Name */}
                  <p className={`mt-2 font-bold ${podiumTextSizes[i]} text-center leading-tight max-w-[80px] truncate`}>
                    {getDisplayName(user)}
                  </p>

                  {/* Telegram ID */}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <svg className="w-3 h-3 text-[hsl(var(--telegram-blue))]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.97-1.73 6.62-2.87 7.94-3.44 3.78-1.58 4.57-1.85 5.08-1.86.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                    </svg>
                    <span className="text-[9px] text-muted-foreground">{user.telegram_id}</span>
                  </div>

                  {/* Coins */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600">{user.coins.toLocaleString()}</span>
                  </div>

                  {/* Podium bar */}
                  <motion.div
                    className={`${podiumHeights[i]} w-16 mt-2 rounded-t-xl bg-gradient-to-t ${colors.bg} ${colors.shadow} shadow-lg`}
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  >
                    <div className="flex items-center justify-center pt-2">
                      <span className="text-white/80 font-black text-lg">#{rankIdx + 1}</span>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rest of leaderboard (4-30) */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Medal className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Reyting jadvali</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {rest.map((user, i) => (
              <motion.div
                key={user.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                {/* Rank */}
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">#{i + 4}</span>
                </div>

                {/* Avatar */}
                <img
                  src={getAvatar(user)}
                  alt={getDisplayName(user)}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{getDisplayName(user)}</p>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-[hsl(var(--telegram-blue))]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.97-1.73 6.62-2.87 7.94-3.44 3.78-1.58 4.57-1.85 5.08-1.86.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                    </svg>
                    <span className="text-[10px] text-muted-foreground">{user.telegram_id}</span>
                  </div>
                </div>

                {/* Coins */}
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-full shrink-0">
                  <Coins className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">{user.coins.toLocaleString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {leaders.length === 0 && !loading && (
        <div className="glass-card p-8 text-center">
          <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Hali o'yinchilar yo'q</p>
        </div>
      )}
    </div>
  );
};
