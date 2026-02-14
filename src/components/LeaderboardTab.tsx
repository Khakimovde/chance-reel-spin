import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star, Coins, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramUser } from '@/lib/telegram';

interface LeaderUser {
  id: string;
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  photo_url: string | null;
  coins: number;
}

const PODIUM_COLORS = [
  { bg: 'from-amber-400 to-yellow-500', ring: 'ring-amber-400/40', label: '🥇' },
  { bg: 'from-slate-300 to-slate-400', ring: 'ring-slate-300/40', label: '🥈' },
  { bg: 'from-orange-400 to-amber-600', ring: 'ring-orange-400/40', label: '🥉' },
];

const TelegramIcon = () => (
  <svg className="w-3 h-3 text-[hsl(var(--telegram-blue))]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.97-1.73 6.62-2.87 7.94-3.44 3.78-1.58 4.57-1.85 5.08-1.86.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
  </svg>
);

const getAvatar = (user: LeaderUser) =>
  user.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.first_name || user.telegram_id}`;

const getDisplayName = (user: LeaderUser) =>
  user.first_name || (user.username ? `@${user.username}` : `ID: ${user.telegram_id}`);

export const LeaderboardTab = () => {
  const [leaders, setLeaders] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);

  const telegramUser = useMemo(() => getTelegramUser(), []);

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

  // Find current user's rank
  const myRank = useMemo(() => {
    if (!telegramUser) return null;
    const idx = leaders.findIndex(u => u.telegram_id === telegramUser.id);
    if (idx === -1) return null;
    return { rank: idx + 1, user: leaders[idx] };
  }, [leaders, telegramUser]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  // Podium order: [1st, 2nd, 3rd] - top to bottom
  const podiumSizes = ['w-14 h-14', 'w-12 h-12', 'w-11 h-11'];

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
    <div className="pb-4 space-y-4">
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

      {/* My Rank */}
      {myRank && (
        <motion.div
          className="glass-card p-3 flex items-center gap-3 border-primary/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Sizning o'rningiz</p>
            <p className="text-sm font-bold">#{myRank.rank} — {getDisplayName(myRank.user)}</p>
          </div>
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-full shrink-0">
            <Coins className="w-3 h-3 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">{myRank.user.coins.toLocaleString()}</span>
          </div>
        </motion.div>
      )}

      {/* Compact Podium - Top 3 */}
      {top3.length >= 3 && (
        <div className="glass-card-elevated p-3 space-y-1.5">
          {top3.map((user, i) => {
            const colors = PODIUM_COLORS[i];
            const isMe = telegramUser && user.telegram_id === telegramUser.id;
            return (
              <motion.div
                key={user.id}
                className={`flex items-center gap-3 p-2 rounded-xl ${isMe ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                  {i === 0 ? (
                    <Crown className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-white font-black text-sm">#{i + 1}</span>
                  )}
                </div>
                <div className={`relative ${podiumSizes[i]} rounded-full ring-2 ${colors.ring} p-0.5 shrink-0`}>
                  <img src={getAvatar(user)} alt="" className="w-full h-full rounded-full object-cover" />
                  <div className="absolute -bottom-1 -right-1 text-xs">{colors.label}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {getDisplayName(user)}
                    {isMe && <span className="text-primary text-[10px] ml-1">(Siz)</span>}
                  </p>
                  <div className="flex items-center gap-1">
                    <TelegramIcon />
                    <span className="text-[10px] text-muted-foreground">{user.telegram_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-full shrink-0">
                  <Coins className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">{user.coins.toLocaleString()}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard (4-30) */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Medal className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Reyting jadvali</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {rest.map((user, i) => {
              const isMe = telegramUser && user.telegram_id === telegramUser.id;
              return (
                <motion.div
                  key={user.id}
                  className={`flex items-center gap-3 px-3 py-2 transition-colors ${isMe ? 'bg-primary/5' : ''}`}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">#{i + 4}</span>
                  </div>
                  <img src={getAvatar(user)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {getDisplayName(user)}
                      {isMe && <span className="text-primary text-[10px] ml-1">(Siz)</span>}
                    </p>
                    <div className="flex items-center gap-1">
                      <TelegramIcon />
                      <span className="text-[10px] text-muted-foreground">{user.telegram_id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full shrink-0">
                    <Coins className="w-3 h-3 text-amber-500" />
                    <span className="text-[11px] font-bold text-amber-700">{user.coins.toLocaleString()}</span>
                  </div>
                </motion.div>
              );
            })}
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
