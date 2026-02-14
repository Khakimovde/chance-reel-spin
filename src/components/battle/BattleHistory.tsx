import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Trophy, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HistoryRound {
  id: string;
  round_time: string;
  status: string;
  total_participants: number;
  total_winners: number;
}

export const BattleHistory = ({ telegramId }: { telegramId: number | undefined }) => {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [myResults, setMyResults] = useState<Record<string, { is_winner: boolean; reward: number }>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetchHistory = async () => {
      const { data } = await supabase
        .from('battle_rounds')
        .select('*')
        .eq('status', 'completed')
        .order('round_time', { ascending: false })
        .limit(20);

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
              className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Battle tarixi
                </h3>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          myResult?.is_winner
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : myResult
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : 'bg-muted'
                        }`}>
                          {myResult?.is_winner ? (
                            <Trophy className="w-4 h-4 text-emerald-600" />
                          ) : myResult ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{time}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {r.total_participants} qatnashchi · {r.total_winners} g'olib
                          </p>
                        </div>
                        {myResult && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            myResult.is_winner
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                              : 'bg-red-100 text-red-500 dark:bg-red-900/30'
                          }`}>
                            +{myResult.reward} 🪙
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
