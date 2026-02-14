import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

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
}: {
  participants: Participant[];
  isOpen: boolean;
  onComplete: () => void;
}) => {
  const [phase, setPhase] = useState<'shuffling' | 'revealing' | 'done'>('shuffling');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [revealedWinners, setRevealedWinners] = useState<Participant[]>([]);

  const winners = participants.filter(p => p.is_winner);
  const displayList = participants.slice(0, 20); // Show max 20 in animation

  const startAnimation = useCallback(() => {
    if (!isOpen || participants.length === 0) return;
    setPhase('shuffling');
    setRevealedWinners([]);
    setHighlightIdx(0);

    // Rapid shuffle phase — 1.5s
    let count = 0;
    const shuffleInterval = setInterval(() => {
      setHighlightIdx(Math.floor(Math.random() * displayList.length));
      count++;
      if (count > 25) {
        clearInterval(shuffleInterval);
        setPhase('revealing');
      }
    }, 60);

    return () => clearInterval(shuffleInterval);
  }, [isOpen, participants.length, displayList.length]);

  useEffect(() => {
    const cleanup = startAnimation();
    return cleanup;
  }, [startAnimation]);

  // Reveal winners one by one
  useEffect(() => {
    if (phase !== 'revealing') return;
    const maxReveal = Math.min(winners.length, 8);
    let i = 0;
    const revealInterval = setInterval(() => {
      if (i < maxReveal) {
        setRevealedWinners(prev => [...prev, winners[i]]);
        i++;
      } else {
        clearInterval(revealInterval);
        setTimeout(() => {
          setPhase('done');
          setTimeout(onComplete, 600);
        }, 800);
      }
    }, 200);
    return () => clearInterval(revealInterval);
  }, [phase, winners, onComplete]);

  if (!isOpen || participants.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="w-full max-w-sm bg-background rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-center">
            <motion.div
              animate={{ rotate: phase === 'shuffling' ? [0, 360] : 0 }}
              transition={{ duration: 0.5, repeat: phase === 'shuffling' ? Infinity : 0 }}
            >
              <Zap className="w-8 h-8 text-white mx-auto mb-1" />
            </motion.div>
            <h3 className="text-lg font-black text-white">
              {phase === 'shuffling' ? 'G\'oliblar tanlanmoqda...' : phase === 'revealing' ? 'G\'oliblar!' : 'Tayyor!'}
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              {participants.length} qatnashchidan {winners.length} g'olib
            </p>
          </div>

          {/* Shuffle Grid */}
          {phase === 'shuffling' && (
            <div className="p-4 grid grid-cols-4 gap-2">
              {displayList.map((p, i) => (
                <motion.div
                  key={p.id}
                  animate={{
                    scale: highlightIdx === i ? 1.15 : 1,
                    borderColor: highlightIdx === i ? 'hsl(var(--primary))' : 'transparent',
                  }}
                  transition={{ duration: 0.05 }}
                  className="flex flex-col items-center p-1.5 rounded-xl border-2"
                >
                  <img
                    src={getAvatar(p)}
                    alt=""
                    className="w-10 h-10 rounded-full"
                    loading="eager"
                  />
                  <span className="text-[8px] font-medium truncate w-full text-center mt-0.5">{getName(p)}</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Reveal Winners */}
          {(phase === 'revealing' || phase === 'done') && (
            <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
              <AnimatePresence>
                {revealedWinners.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50"
                  >
                    <img src={getAvatar(p)} alt="" className="w-9 h-9 rounded-full ring-2 ring-emerald-400" />
                    <span className="text-sm font-semibold flex-1 truncate">{getName(p)}</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                      🏆 +20 🪙
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {revealedWinners.length < Math.min(winners.length, 8) && (
                <div className="flex justify-center py-2">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 0.6 }}
                    className="text-xs text-muted-foreground"
                  >
                    tanlanmoqda...
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
