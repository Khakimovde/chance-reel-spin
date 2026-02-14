import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, X } from 'lucide-react';

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

export const BattleSelectionAnimation = ({
  participants,
  isOpen,
  onComplete,
  myTelegramId,
}: {
  participants: Participant[];
  isOpen: boolean;
  onComplete: () => void;
  myTelegramId?: number;
}) => {
  const [phase, setPhase] = useState<'countdown' | 'revealing' | 'result'>('countdown');
  const [revealedWinners, setRevealedWinners] = useState<Participant[]>([]);
  const [myResult, setMyResult] = useState<'won' | 'lost' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const winners = participants.filter(p => p.is_winner);
  const iAmWinner = myTelegramId ? winners.some(w => w.telegram_id === myTelegramId) : false;

  const cleanup = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen || participants.length === 0) return;
    setPhase('countdown');
    setRevealedWinners([]);
    setMyResult(null);

    // "Boshlandi!" for 1.5s then start revealing
    const countdownTimer = setTimeout(() => {
      setPhase('revealing');
    }, 1500);

    return () => {
      clearTimeout(countdownTimer);
      cleanup();
    };
  }, [isOpen, participants.length, cleanup]);

  // Reveal winners one by one
  useEffect(() => {
    if (phase !== 'revealing') return;

    const maxShow = Math.min(winners.length, 50); // Show max 50 for performance
    let idx = 0;

    // Speed: faster for more winners (min 80ms, max 300ms per entry)
    const speed = Math.max(80, Math.min(300, 4000 / maxShow));

    revealTimerRef.current = setInterval(() => {
      if (idx < maxShow) {
        setRevealedWinners(prev => [...prev, winners[idx]]);
        idx++;
      } else {
        cleanup();
        // Short pause then show result
        setTimeout(() => {
          setMyResult(iAmWinner ? 'won' : 'lost');
          setPhase('result');
        }, 600);
      }
    }, speed);

    return cleanup;
  }, [phase, winners, iAmWinner, cleanup]);

  // Auto-scroll to bottom as winners appear
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [revealedWinners]);

  if (!isOpen || participants.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm bg-background rounded-2xl overflow-hidden shadow-2xl border border-border/50 flex flex-col"
          style={{ maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-white" />
              <div>
                <h3 className="text-sm font-black text-white leading-tight">
                  {phase === 'countdown' ? 'Boshlandi!' : phase === 'revealing' ? "G'oliblar aniqlanmoqda..." : 'Natija!'}
                </h3>
                <p className="text-[10px] text-white/70">
                  {participants.length} qatnashchidan {winners.length} g'olib
                </p>
              </div>
            </div>
            {phase === 'result' && (
              <button onClick={onComplete} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Countdown phase */}
          {phase === 'countdown' && (
            <div className="flex-1 flex items-center justify-center py-16">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-center"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.4 }}
                >
                  <Zap className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                </motion.div>
                <h2 className="text-2xl font-black text-foreground">Boshlandi! ⚡</h2>
                <p className="text-sm text-muted-foreground mt-1">G'oliblar aniqlanmoqda...</p>
              </motion.div>
            </div>
          )}

          {/* Winners list - scrollable */}
          {(phase === 'revealing' || phase === 'result') && myResult === null && (
            <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
              <AnimatePresence>
                {revealedWinners.map((p, i) => {
                  const isMe = myTelegramId && p.telegram_id === myTelegramId;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${
                        isMe
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-400'
                          : 'bg-muted/40'
                      }`}
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                      <img src={getAvatar(p)} alt="" className="w-8 h-8 rounded-full" />
                      <span className={`text-sm font-semibold flex-1 truncate ${isMe ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                        {getName(p)} {isMe ? '(Siz!)' : ''}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">+20 🪙</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {phase === 'revealing' && (
                <div className="flex justify-center py-2">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Zap className="w-3 h-3" />
                    aniqlanmoqda...
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {/* Final result */}
          {phase === 'result' && myResult && (
            <div className="flex-1 flex items-center justify-center py-10 px-6">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-center w-full"
              >
                {myResult === 'won' ? (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-6xl mb-4"
                    >
                      🏆
                    </motion.div>
                    <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      Tabriklaymiz! 🎉
                    </h2>
                    <p className="text-base font-semibold text-foreground mt-2">
                      Siz g'olib bo'ldingiz!
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-lg font-bold">
                      +20 🪙
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      animate={{ rotate: [0, -5, 5, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="text-6xl mb-4"
                    >
                      😔
                    </motion.div>
                    <h2 className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      Yutqizdingiz
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Omad keyingi safar kulib boqadi! 💪
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-full text-lg font-bold">
                      +10 🪙
                    </div>
                  </>
                )}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onComplete}
                  className={`mt-6 w-full py-3 rounded-xl font-bold text-white ${
                    myResult === 'won'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500'
                  }`}
                >
                  {myResult === 'won' ? 'Ajoyib! ✨' : 'Yana urinib ko\'ring! 🔄'}
                </motion.button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
