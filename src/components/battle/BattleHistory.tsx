import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Trophy, XCircle, Loader2, ChevronRight, ArrowLeft, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HistoryRound {
  id: string;
  round_time: string;
  status: string;
  total_participants: number;
  total_winners: number;
}

interface Participant {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  is_winner: boolean;
  reward: number;
}

const getAvatar = (p: Participant) =>
  p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name || p.telegram_id}`;
const getName = (p: Participant) => p.first_name || p.username || `User ${p.telegram_id}`;

export const BattleHistory = ({ telegramId }: { telegramId: number | undefined }) => {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [myResults, setMyResults] = useState<Record<string, { is_winner: boolean; reward: number }>>({});
  const [selectedRound, setSelectedRound] = useState<HistoryRound | null>(null);
  const [roundParticipants, setRoundParticipants] = useState<Participant[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) { setSelectedRound(null); return; }
    setLoading(true);

    const fetchHistory = async () => {
      // Only show last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('battle_rounds')
        .select('*')
        .eq('status', 'completed')
        .gte('round_time', sixHoursAgo)
        .order('round_time', { ascending: false })
        .limit(30);

      const roundsList = (data || []) as HistoryRound[];
      setRounds(roundsList);

      if (telegramId && roundsList.length > 0) {
        const roundIds = roundsList.map(r => r.id);
        const { data: parts } = await supabase
          .from('battle_participants')
          .select('round_id, is_winner, reward')
          .eq('telegram_id', telegramId)
          .in('round_id', roundIds);

        const map: Record<string, { is_winner: boolean; reward: number }> = {};
        (parts || []).forEach((p: any) => { map[p.round_id] = { is_winner: p.is_winner, reward: p.reward }; });
        setMyResults(map);
      }

      setLoading(false);
    };

    fetchHistory();
  }, [open, telegramId]);

  const openRoundDetail = async (round: HistoryRound) => {
    setSelectedRound(round);
    setLoadingDetail(true);
    const { data } = await supabase
      .from('battle_participants')
      .select('*')
      .eq('round_id', round.id)
      .order('is_winner', { ascending: false });
    setRoundParticipants((data || []) as Participant[]);
    setLoadingDetail(false);
  };

  const winners = roundParticipants.filter(p => p.is_winner);
  const losers = roundParticipants.filter(p => !p.is_winner);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted"
      >
        <History className="w-3.5 h-3.5" />
        Tarix
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl flex flex-col"
              style={{ maxHeight: '70vh', marginBottom: 'env(safe-area-inset-bottom, 60px)', paddingBottom: '60px' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                {selectedRound ? (
                  <button onClick={() => setSelectedRound(null)} className="flex items-center gap-2 text-sm font-bold">
                    <ArrowLeft className="w-4 h-4" />
                    Raund tafsilotlari
                  </button>
                ) : (
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Battle tarixi
                  </h3>
                )}
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {!selectedRound ? (
                  /* Round List */
                  <div className="p-4 space-y-2">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : rounds.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-12">Hali raundlar yo'q</p>
                    ) : (
                      rounds.map((r) => {
                        const myResult = myResults[r.id];
                        const time = new Date(r.round_time).toLocaleString('uz-UZ', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        });

                        return (
                          <motion.button
                            key={r.id}
                            onClick={() => openRoundDetail(r)}
                            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/70 transition-colors text-left"
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              myResult?.is_winner
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : myResult
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : 'bg-muted'
                            }`}>
                              {myResult?.is_winner ? (
                                <Trophy className="w-4.5 h-4.5 text-emerald-600" />
                              ) : myResult ? (
                                <XCircle className="w-4.5 h-4.5 text-red-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold">{time}</p>
                                {myResult && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    myResult.is_winner
                                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                                      : 'bg-red-100 text-red-500 dark:bg-red-900/30'
                                  }`}>
                                    {myResult.is_winner ? 'G\'alaba' : 'Mag\'lubiyat'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Users className="w-2.5 h-2.5" /> {r.total_participants} kishi
                                </span>
                                <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                  <Trophy className="w-2.5 h-2.5" /> {r.total_winners} g'olib
                                </span>
                              </div>
                            </div>
                            {myResult && (
                              <span className={`text-xs font-bold shrink-0 ${
                                myResult.is_winner ? 'text-emerald-600' : 'text-red-500'
                              }`}>
                                +{myResult.reward} 🪙
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Round Detail */
                  <div className="p-4 space-y-4">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/30 p-3 text-center">
                            <p className="text-2xl font-black text-emerald-600">{winners.length}</p>
                            <p className="text-[10px] text-emerald-600 font-semibold">G'oliblar (+20 🪙)</p>
                          </div>
                          <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/30 p-3 text-center">
                            <p className="text-2xl font-black text-red-500">{losers.length}</p>
                            <p className="text-[10px] text-red-500 font-semibold">Yutqizganlar (+10 🪙)</p>
                          </div>
                        </div>

                        {/* Winners */}
                        {winners.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5" /> G'oliblar
                            </p>
                            {winners.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/30">
                                <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full ring-2 ring-emerald-400" />
                                <span className="text-sm font-medium flex-1 truncate">{getName(p)}</span>
                                <span className="text-xs font-bold text-emerald-600">+20 🪙</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Losers */}
                        {losers.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" /> Yutqizganlar
                            </p>
                            {losers.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/30">
                                <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full ring-1 ring-red-300 opacity-80" />
                                <span className="text-sm font-medium flex-1 truncate text-muted-foreground">{getName(p)}</span>
                                <span className="text-xs font-bold text-red-500">+10 🪙</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
