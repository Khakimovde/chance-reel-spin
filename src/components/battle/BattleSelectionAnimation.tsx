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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Freeze participants on open to prevent re-render issues
  const frozenRef = useRef<Participant[]>([]);
  const isInitialized = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // Initialize only once when isOpen becomes true
  useEffect(() => {
    if (!isOpen || participants.length === 0) {
      isInitialized.current = false;
      return;
    }
    
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    // Freeze participants
    frozenRef.current = [...participants];
    
    cleanup();
    setPhase('countdown');
    setRevealedWinners([]);
    setMyResult(null);

    timerRef.current = setTimeout(() => {
      setPhase('revealing');
    }, 1500);

    return () => {
      cleanup();
      isInitialized.current = false;
    };
  }, [isOpen]); // Only depend on isOpen, NOT participants

  // Reveal winners one by one
  useEffect(() => {
    if (phase !== 'revealing') return;

    const allParticipants = frozenRef.current;
    const winners = allParticipants.filter(p => p.is_winner);
    const winnersToShow = winners.slice(0, 50);
    const iAmWinner = myTelegramId ? winners.some(w => w.telegram_id === myTelegramId) : false;

    if (winnersToShow.length === 0) {
      setMyResult(iAmWinner ? 'won' : 'lost');
      setPhase('result');
      return;
    }

    const speed = Math.max(80, Math.min(300, 4000 / winnersToShow.length));
    let idx = 0;

    intervalRef.current = setInterval(() => {
      if (idx < winnersToShow.length) {
        const winner = winnersToShow[idx];
        if (winner) {
          setRevealedWinners(prev => [...prev, winner]);
        }
        idx++;
      } else {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setMyResult(iAmWinner ? 'won' : 'lost');
        setPhase('result');
        timerRef.current = setTimeout(onComplete, 3000);
      }
    }, speed);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [revealedWinners]);

  if (!isOpen || participants.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
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
                {frozenRef.current.length} qatnashchidan {frozenRef.current.filter(p => p.is_winner).length} g'olib
              </p>
            </div>
          </div>
          <button onClick={onComplete} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Countdown phase */}
        {phase === 'countdown' && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Zap className="w-12 h-12 text-amber-500 mx-auto mb-3 animate-pulse" />
              <h2 className="text-2xl font-black text-foreground">Boshlandi! ⚡</h2>
              <p className="text-sm text-muted-foreground mt-1">G'oliblar aniqlanmoqda...</p>
            </div>
          </div>
        )}

        {/* Winners list */}
        {(phase === 'revealing' || phase === 'result') && myResult === null && (
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
            {revealedWinners.map((p, i) => {
              if (!p) return null;
              const isMe = myTelegramId && p.telegram_id === myTelegramId;
              return (
                <div
                  key={p.id}
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
                  <span className="text-xs font-bold text-emerald-600">+{p.reward || 20} 🪙</span>
                </div>
              );
            })}

            {phase === 'revealing' && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Zap className="w-3 h-3" />
                  aniqlanmoqda...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final result */}
        {phase === 'result' && myResult && (
          <div className="flex-1 flex items-center justify-center py-10 px-6">
            <div className="text-center w-full">
              {myResult === 'won' ? (
                <>
                  <div className="text-6xl mb-4">🏆</div>
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
                  <div className="text-6xl mb-4">😔</div>
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

              <button
                onClick={onComplete}
                className={`mt-6 w-full py-3 rounded-xl font-bold text-white ${
                  myResult === 'won'
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500'
                }`}
              >
                {myResult === 'won' ? 'Ajoyib! ✨' : 'Yana urinib ko\'ring! 🔄'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
