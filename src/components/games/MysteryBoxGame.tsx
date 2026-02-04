import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift, Loader2, Frown } from 'lucide-react';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BET_OPTIONS = [20, 50, 100, 200];

// Heavily weighted toward losses - house always wins
const getReward = (betAmount: number): { multiplier: number; emoji: string; name: string } => {
  const rand = Math.random();
  
  // 45% - Nothing (0x)
  if (rand < 0.45) {
    return { multiplier: 0, emoji: '💨', name: "Bo'sh" };
  }
  // 25% - Lose some (0.2x)
  if (rand < 0.70) {
    return { multiplier: 0.2, emoji: '😐', name: 'Oz' };
  }
  // 15% - Break even (0.5x)
  if (rand < 0.85) {
    return { multiplier: 0.5, emoji: '🙂', name: "O'rtacha" };
  }
  // 8% - Small win (1.2x)
  if (rand < 0.93) {
    return { multiplier: 1.2, emoji: '😊', name: 'Yaxshi' };
  }
  // 4% - Medium win (1.5x)
  if (rand < 0.97) {
    return { multiplier: 1.5, emoji: '🤩', name: 'Ajoyib' };
  }
  // 2% - Rare (2x)
  if (rand < 0.99) {
    return { multiplier: 2, emoji: '🎊', name: 'Kamyob' };
  }
  // 1% - Jackpot (3x)
  return { multiplier: 3, emoji: '💎', name: 'Jackpot' };
};

export const MysteryBoxGame = () => {
  const { user, refreshUserData } = useTelegram();
  const [betAmount, setBetAmount] = useState(BET_OPTIONS[0]);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [reward, setReward] = useState<{ multiplier: number; emoji: string; name: string } | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const processedRef = useRef(false);

  const userCoins = user?.coins || 0;

  useEffect(() => {
    loadAdSdk();
  }, []);

  const openBox = async () => {
    if (processedRef.current || isLoading || isOpening) return;

    if (userCoins < betAmount) {
      toast.error("Balans yetarli emas!");
      hapticFeedback('error');
      return;
    }

    processedRef.current = true;
    setIsLoading(true);
    hapticFeedback('medium');

    try {
      // Show ad first
      const adShown = await showAd();
      if (!adShown) {
        processedRef.current = false;
        setIsLoading(false);
        return;
      }

      // Deduct bet
      const { error: betError } = await supabase.functions.invoke('update-coins', {
        body: {
          telegramId: user?.id,
          amount: -betAmount,
          source: 'box_bet'
        }
      });

      if (betError) {
        toast.error("Tikish xatosi!");
        processedRef.current = false;
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsOpening(true);

      // Animate box opening
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Calculate reward
      const boxReward = getReward(betAmount);
      const win = Math.floor(betAmount * boxReward.multiplier);
      
      setReward(boxReward);
      setWinAmount(win);

      // If won something, add to balance
      if (win > 0) {
        hapticFeedback('success');
        await supabase.functions.invoke('update-coins', {
          body: {
            telegramId: user?.id,
            amount: win,
            source: 'box_win'
          }
        });
      } else {
        hapticFeedback('error');
      }

      await refreshUserData();
      setIsOpening(false);
      setShowResult(true);
      processedRef.current = false;
    } catch (err) {
      console.error(err);
      toast.error("Xatolik yuz berdi");
      setIsLoading(false);
      setIsOpening(false);
      processedRef.current = false;
    }
  };

  const resetGame = () => {
    setShowResult(false);
    setReward(null);
    setWinAmount(0);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">🎁 Sirli Sandiq</h2>
        <p className="text-xs text-muted-foreground">Sandiqni oching, sovg'a yutib oling!</p>
      </div>

      <div className="space-y-4 px-4">
        {/* Bet Selection */}
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
            Balans: <span className="font-bold text-amber-500">{userCoins}</span> tanga
          </div>
        </div>

        {/* Mystery Box Display */}
        <div className="flex justify-center py-6">
          <motion.div
            animate={isOpening ? {
              rotateY: [0, 15, -15, 10, -10, 5, -5, 0],
              scale: [1, 1.05, 1.05, 1.1, 1.1, 1.15, 1.15, 1.2],
            } : {
              y: [0, -5, 0],
            }}
            transition={isOpening ? {
              duration: 1.5,
              ease: "easeInOut"
            } : {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            {/* Box glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-violet-500/30 blur-2xl rounded-full" />
            
            {/* Box */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-violet-600 to-purple-700 rounded-3xl shadow-2xl transform rotate-3" />
              <div className="absolute inset-2 bg-gradient-to-br from-purple-400 via-violet-500 to-purple-600 rounded-2xl shadow-inner" />
              
              {/* Ribbon */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-gradient-to-b from-amber-400 to-amber-500 rounded" />
              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-8 bg-gradient-to-r from-amber-400 to-amber-500 rounded" />
              
              {/* Bow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                <div className="text-4xl">🎀</div>
              </div>

              {/* Question mark or loading */}
              <div className="relative z-10 text-5xl">
                {isLoading || isOpening ? (
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                ) : (
                  '❓'
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Open Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={openBox}
          disabled={isLoading || isOpening || userCoins < betAmount}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold text-lg shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isOpening ? (
            'Ochilmoqda...'
          ) : (
            <>
              <Gift className="w-5 h-5" />
              <span>Sandiqni Ochish</span>
            </>
          )}
        </motion.button>

        <p className="text-center text-xs text-muted-foreground">
          (1 ta reklama ko'rib ochiladi)
        </p>

        {/* Reward Info */}
        <div className="bg-card/30 rounded-xl p-3">
          <p className="text-xs text-muted-foreground text-center mb-2">Mumkin bo'lgan sovg'alar:</p>
          <div className="flex justify-center gap-3 text-xs">
            <span>💨 0x</span>
            <span>😐 0.2x</span>
            <span>🙂 0.5x</span>
            <span>😊 1.2x</span>
            <span>🤩 1.5x</span>
            <span>💎 3x</span>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && reward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowResult(false);
              resetGame();
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-3xl p-6 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl ${
                  winAmount > 0 
                    ? 'bg-gradient-to-br from-purple-400 to-violet-600' 
                    : 'bg-gradient-to-br from-gray-400 to-gray-600'
                }`}
              >
                {reward.emoji}
              </motion.div>

              <div>
                <p className="text-lg text-muted-foreground">{reward.name}</p>
                <p className="text-4xl font-black mt-2 text-foreground">
                  {winAmount > 0 ? (
                    <>+{winAmount} Tanga</>
                  ) : (
                    <>Bo'sh chiqdi 😢</>
                  )}
                </p>
                {winAmount > 0 && (
                  <p className="text-sm text-green-500 mt-1">
                    {reward.multiplier}x koeffitsient!
                  </p>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShowResult(false);
                  resetGame();
                }}
                className={`w-full py-4 rounded-2xl text-white font-bold ${
                  winAmount > 0 
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600' 
                    : 'bg-gradient-to-r from-gray-500 to-gray-600'
                }`}
              >
                {winAmount > 0 ? 'Ajoyib! 🎊' : 'Qayta Urinish'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
