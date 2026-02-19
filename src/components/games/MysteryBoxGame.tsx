import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Loader2, Sparkles } from 'lucide-react';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGameStore } from '@/store/gameStore';

const BET_OPTIONS = [20, 50, 100, 200];

// Weighted rewards - heavily favors the house
const getReward = (): { multiplier: number; label: string; emoji: string } => {
  const rand = Math.random();
  
  if (rand < 0.45) return { multiplier: 0, label: "Bo'sh", emoji: '💨' };
  if (rand < 0.70) return { multiplier: 0.5, label: '0.5x', emoji: '😐' };
  if (rand < 0.85) return { multiplier: 1, label: '1x', emoji: '🙂' };
  if (rand < 0.94) return { multiplier: 1.5, label: '1.5x', emoji: '😊' };
  if (rand < 0.98) return { multiplier: 2, label: '2x', emoji: '🤩' };
  return { multiplier: 3, label: 'JACKPOT 3x', emoji: '💎' };
};

interface BoxState {
  id: number;
  isOpen: boolean;
  reward: { multiplier: number; label: string; emoji: string } | null;
}

export const MysteryBoxGame = () => {
  const { user, refreshUserData } = useTelegram();
  const addCoins = useGameStore((s) => s.addCoins);
  const removeCoins = useGameStore((s) => s.removeCoins);
  const [betAmount, setBetAmount] = useState(BET_OPTIONS[0]);
  const [boxes, setBoxes] = useState<BoxState[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalReward, setFinalReward] = useState<{ multiplier: number; label: string; emoji: string } | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const processedRef = useRef(false);

  const userCoins = user?.coins || 0;

  useEffect(() => {
    loadAdSdk();
  }, []);

  const initializeGame = () => {
    const newBoxes: BoxState[] = Array.from({ length: 9 }, (_, i) => ({
      id: i,
      isOpen: false,
      reward: null,
    }));
    setBoxes(newBoxes);
    setGameOver(false);
    setShowResult(false);
    setFinalReward(null);
    setWinAmount(0);
  };

  const startGame = async () => {
    if (processedRef.current || isLoading) return;
    
    if (userCoins < betAmount) {
      toast.error("Balans yetarli emas!");
      hapticFeedback('error');
      return;
    }

    processedRef.current = true;
    setIsLoading(true);
    hapticFeedback('medium');

    try {
      const adShown = await showAd();
      if (!adShown) {
        processedRef.current = false;
        setIsLoading(false);
        return;
      }

      // Optimistic update
      removeCoins(betAmount);

      const { error } = await supabase.functions.invoke('update-coins', {
        body: { telegramId: user?.id, amount: -betAmount, source: 'box_bet' }
      });

      if (error) {
        addCoins(betAmount);
        toast.error("Tikish xatosi!");
        processedRef.current = false;
        setIsLoading(false);
        return;
      }

      refreshUserData();
      initializeGame();
      setGameStarted(true);
      setIsLoading(false);
      processedRef.current = false;
    } catch (err) {
      console.error(err);
      addCoins(betAmount);
      toast.error("Xatolik yuz berdi");
      setIsLoading(false);
      processedRef.current = false;
    }
  };

  const openBox = async (boxId: number) => {
    if (gameOver || boxes[boxId].isOpen || processedRef.current) return;

    processedRef.current = true;
    hapticFeedback('medium');

    const reward = getReward();
    const win = Math.floor(betAmount * reward.multiplier);

    const newBoxes = boxes.map((box, i) => ({
      ...box,
      isOpen: i === boxId,
      reward: i === boxId ? reward : null,
    }));
    setBoxes(newBoxes);
    setFinalReward(reward);
    setWinAmount(win);
    setGameOver(true);

    if (win > 0) {
      hapticFeedback('success');
      addCoins(win);
      
      try {
        await supabase.functions.invoke('update-coins', {
          body: { telegramId: user?.id, amount: win, source: 'box_win' }
        });
        refreshUserData();
      } catch (err) {
        console.error(err);
        removeCoins(win);
      }
    } else {
      hapticFeedback('error');
    }

    setTimeout(() => {
      setShowResult(true);
      processedRef.current = false;
    }, 400);
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setBoxes([]);
    setShowResult(false);
    setFinalReward(null);
    setWinAmount(0);
  };

  return (
    <div className="space-y-4 px-4">
      {!gameStarted ? (
        <div className="space-y-4">
          <div className="bg-card/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tikish miqdori:</span>
              <div className="flex items-center gap-1">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-foreground">{betAmount}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {BET_OPTIONS.map((amount) => (
                <motion.button
                  key={amount}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setBetAmount(amount)}
                  disabled={userCoins < amount}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    betAmount === amount
                      ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg'
                      : userCoins < amount
                        ? 'bg-muted/50 text-muted-foreground'
                        : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {amount}
                </motion.button>
              ))}
            </div>

            <div className="text-center text-xs text-muted-foreground">
              Balans: <span className="font-bold text-green-500">${userCoins}</span>
            </div>
          </div>

          <div className="bg-card/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">Mumkin bo'lgan yutuqlar:</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-500/20 rounded-lg py-1">💨 Bo'sh</div>
              <div className="bg-orange-500/20 rounded-lg py-1">😐 0.5x</div>
              <div className="bg-blue-500/20 rounded-lg py-1">🙂 1x</div>
              <div className="bg-green-500/20 rounded-lg py-1">😊 1.5x</div>
              <div className="bg-purple-500/20 rounded-lg py-1">🤩 2x</div>
              <div className="bg-amber-500/20 rounded-lg py-1">💎 3x</div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={startGame}
            disabled={isLoading || userCoins < betAmount}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold text-lg shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span className="text-xl">🎁</span> O'yinni Boshlash</>}
          </motion.button>

          <p className="text-center text-xs text-muted-foreground">(1 ta reklama ko'rib o'ynaysiz)</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">9 ta sandiqdan birini tanlang!</p>
            <p className="text-xs text-green-500">Tikish: ${betAmount}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {boxes.map((box) => (
              <motion.button
                key={box.id}
                whileTap={!box.isOpen && !gameOver ? { scale: 0.9 } : {}}
                onClick={() => openBox(box.id)}
                disabled={box.isOpen || gameOver}
                className="aspect-square relative"
              >
                <AnimatePresence mode="wait">
                  {box.isOpen ? (
                    <motion.div
                      initial={{ rotateY: 90 }}
                      animate={{ rotateY: 0 }}
                      className={`w-full h-full rounded-2xl flex flex-col items-center justify-center ${
                        box.reward?.multiplier === 0 ? 'bg-slate-600' : 'bg-gradient-to-br from-green-400 to-emerald-600'
                      }`}
                    >
                      <span className="text-3xl">{box.reward?.emoji}</span>
                      <span className="text-xs font-bold text-white mt-1">{box.reward?.label}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-4xl">🎁</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>

          {gameOver && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetGame}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold"
            >
              Qayta O'ynash
            </motion.button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showResult && finalReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-3xl p-6 text-center space-y-4"
            >
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl ${
                finalReward.multiplier > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-slate-400 to-slate-600'
              }`}>
                {finalReward.emoji}
              </div>

              <div>
                <p className="text-lg text-muted-foreground">{finalReward.multiplier > 0 ? '🎉 Tabriklaymiz!' : "Bo'sh chiqdi!"}</p>
                <p className="text-3xl font-black mt-2 text-foreground">{finalReward.multiplier > 0 ? `+$${winAmount}` : "Yutkizdingiz"}</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { setShowResult(false); resetGame(); }}
                className={`w-full py-4 rounded-2xl text-white font-bold ${
                  finalReward.multiplier > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-purple-500 to-violet-600'
                }`}
              >
                {finalReward.multiplier > 0 ? 'Ajoyib! 🎊' : 'Qayta Urinish'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
