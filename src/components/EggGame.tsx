import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Play, Coins } from 'lucide-react';
import { showAd } from '@/lib/adService';
import { supabase } from '@/integrations/supabase/client';
import { getTelegramUser } from '@/lib/telegram';
import { toast } from 'sonner';

const MAX_ENERGY = 5;
const CRACK_STAGES = 3;

// Reward tiers with probabilities
const REWARDS = [
  { min: 1, max: 5, weight: 40 },
  { min: 5, max: 15, weight: 30 },
  { min: 15, max: 30, weight: 20 },
  { min: 30, max: 100, weight: 8 },
  { min: 100, max: 500, weight: 2 },
];

function getRandomReward(): number {
  const totalWeight = REWARDS.reduce((s, r) => s + r.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const tier of REWARDS) {
    rand -= tier.weight;
    if (rand <= 0) {
      return Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
    }
  }
  return 1;
}

interface FloatingCoin {
  id: number;
  x: number;
  y: number;
  amount: number;
}

export const EggGame = () => {
  const [energy, setEnergy] = useState(() => {
    try {
      const saved = localStorage.getItem('egg_energy');
      const savedTime = localStorage.getItem('egg_energy_time');
      if (saved && savedTime) {
        const elapsed = Date.now() - Number(savedTime);
        const recovered = Math.floor(elapsed / (5 * 60 * 1000)); // 1 energy per 5 min
        return Math.min(MAX_ENERGY, Number(saved) + recovered);
      }
      return MAX_ENERGY;
    } catch { return MAX_ENERGY; }
  });
  const [crackStage, setCrackStage] = useState(0);
  const [tapping, setTapping] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [showReward, setShowReward] = useState(false);
  const [floatingCoins, setFloatingCoins] = useState<FloatingCoin[]>([]);
  const [loadingAd, setLoadingAd] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);
  const coinIdRef = useRef(0);
  const eggRef = useRef<HTMLDivElement>(null);

  // Save energy to localStorage
  useEffect(() => {
    localStorage.setItem('egg_energy', String(energy));
    localStorage.setItem('egg_energy_time', String(Date.now()));
  }, [energy]);

  // Energy recovery timer
  useEffect(() => {
    if (energy >= MAX_ENERGY) return;
    const interval = setInterval(() => {
      setEnergy(prev => {
        const next = Math.min(MAX_ENERGY, prev + 1);
        return next;
      });
    }, 5 * 60 * 1000); // 1 energy per 5 min
    return () => clearInterval(interval);
  }, [energy]);

  const addFloatingCoin = useCallback((x: number, y: number, amount: number) => {
    const id = ++coinIdRef.current;
    setFloatingCoins(prev => [...prev, { id, x, y, amount }]);
    setTimeout(() => {
      setFloatingCoins(prev => prev.filter(c => c.id !== id));
    }, 1200);
  }, []);

  const handleTap = useCallback(() => {
    if (energy <= 0 || tapping || showReward) return;

    setTapping(true);
    const nextStage = crackStage + 1;
    setCrackStage(nextStage);

    // Add tap effect
    if (eggRef.current) {
      const rect = eggRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 60;
      const y = rect.top + rect.height * 0.3 + (Math.random() - 0.5) * 40;
      addFloatingCoin(x, y, 0);
    }

    setTimeout(() => setTapping(false), 150);

    if (nextStage >= CRACK_STAGES) {
      // Egg breaks!
      setEnergy(prev => prev - 1);
      const earned = getRandomReward();
      setReward(earned);
      setTotalEarned(prev => prev + earned);
      
      setTimeout(() => {
        setShowReward(true);
        // Save coins to backend
        const telegramUser = getTelegramUser();
        if (telegramUser) {
          supabase.functions.invoke('update-coins', {
            body: {
              telegramId: telegramUser.id,
              amount: earned,
              source: 'egg_game'
            }
          }).catch(console.error);
        }
      }, 400);
    }
  }, [energy, crackStage, tapping, showReward, addFloatingCoin]);

  const resetEgg = useCallback(() => {
    setCrackStage(0);
    setReward(null);
    setShowReward(false);
  }, []);

  const handleWatchAd = useCallback(async () => {
    if (loadingAd) return;
    setLoadingAd(true);
    try {
      toast.info('Reklama ko\'rilmoqda...');
      const adShown = await showAd();
      if (adShown) {
        setEnergy(MAX_ENERGY);
        toast.success(`Energiya to'ldirildi! ⚡`);
      } else {
        toast.error('Reklama ko\'rsatilmadi');
      }
    } catch {
      toast.error('Xatolik yuz berdi');
    } finally {
      setLoadingAd(false);
    }
  }, [loadingAd]);

  // Egg SVG with crack stages
  const renderEgg = () => {
    const cracks = crackStage;
    return (
      <div ref={eggRef} className="relative">
        <motion.div
          className="relative cursor-pointer select-none"
          animate={tapping ? { 
            scale: [1, 0.92, 1.05, 1],
            rotate: [0, -3, 3, 0]
          } : {}}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.03 }}
          onTap={handleTap}
        >
          {/* Egg glow */}
          <div className="absolute inset-0 blur-3xl opacity-30 rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(38 92% 60%), hsl(28 80% 40%))' }}
          />
          
          {/* Main egg */}
          <svg viewBox="0 0 200 260" className="w-48 h-60 drop-shadow-2xl relative z-10">
            <defs>
              <radialGradient id="eggGrad" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="hsl(38, 95%, 75%)" />
                <stop offset="40%" stopColor="hsl(35, 90%, 65%)" />
                <stop offset="100%" stopColor="hsl(28, 85%, 45%)" />
              </radialGradient>
              <radialGradient id="eggShine" cx="35%" cy="25%" r="30%">
                <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <filter id="eggShadow">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="hsl(28, 80%, 30%)" floodOpacity="0.3" />
              </filter>
            </defs>
            
            {/* Egg shape */}
            <ellipse cx="100" cy="145" rx="80" ry="105" fill="url(#eggGrad)" filter="url(#eggShadow)" />
            <ellipse cx="100" cy="145" rx="80" ry="105" fill="url(#eggShine)" />
            
            {/* Decorative pattern */}
            <ellipse cx="100" cy="145" rx="70" ry="95" fill="none" stroke="hsl(38, 80%, 55%)" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3" />
            
            {/* Star pattern on egg */}
            <text x="100" y="130" textAnchor="middle" fontSize="24" fill="hsl(38, 100%, 80%)" opacity="0.4">✦</text>
            <text x="70" y="160" textAnchor="middle" fontSize="16" fill="hsl(38, 100%, 80%)" opacity="0.3">✧</text>
            <text x="130" y="155" textAnchor="middle" fontSize="18" fill="hsl(38, 100%, 80%)" opacity="0.35">✧</text>
            
            {/* Crack lines */}
            {cracks >= 1 && (
              <motion.path
                d="M100 60 L95 90 L105 100 L90 120"
                stroke="hsl(28, 60%, 35%)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
            {cracks >= 2 && (
              <motion.path
                d="M85 100 L75 130 L85 140 L70 165"
                stroke="hsl(28, 60%, 35%)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
            {cracks >= 3 && (
              <motion.path
                d="M110 85 L120 115 L110 135 L125 160"
                stroke="hsl(28, 60%, 35%)"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </svg>

          {/* Tap hint */}
          {crackStage === 0 && energy > 0 && !showReward && (
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              👆 Bosing!
            </motion.div>
          )}
        </motion.div>

        {/* Floating coin effects */}
        <AnimatePresence>
          {floatingCoins.map(coin => (
            <motion.div
              key={coin.id}
              className="fixed z-50 pointer-events-none"
              style={{ left: coin.x, top: coin.y }}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -60, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <span className="text-2xl">✨</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-lg">🥚</span>
          </div>
          <div>
            <h2 className="text-base font-black leading-tight">Tuxum O'yini</h2>
            <p className="text-[10px] text-muted-foreground font-medium">Tuxumni sindirib tanga yutib oling!</p>
          </div>
        </div>
        {totalEarned > 0 && (
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-full">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">+{totalEarned}</span>
          </div>
        )}
      </div>

      {/* Energy bar */}
      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold">Energiya</span>
          </div>
          <span className="text-xs font-bold text-amber-600">{energy}/{MAX_ENERGY}</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(28 85% 50%))' }}
            initial={false}
            animate={{ width: `${(energy / MAX_ENERGY) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {energy === 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5">Energiya 5 daqiqada 1 ta tiklanadi</p>
        )}
      </div>

      {/* Egg area */}
      <div className="flex flex-col items-center justify-center py-6 min-h-[300px]">
        <AnimatePresence mode="wait">
          {showReward && reward ? (
            <motion.div
              key="reward"
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              {/* Broken egg pieces */}
              <div className="relative">
                <motion.span 
                  className="text-7xl"
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🐣
                </motion.span>
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <span className="text-2xl">✨</span>
                </motion.div>
              </div>

              <motion.div
                className="text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">Tabriklaymiz! 🎉</p>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-3xl font-black text-amber-600">+{reward}</span>
                  <span className="text-lg font-semibold text-muted-foreground">tanga</span>
                </div>
              </motion.div>

              <motion.button
                onClick={resetEgg}
                className="mt-2 px-8 py-3 rounded-2xl font-bold text-white shadow-xl bg-gradient-to-r from-amber-400 to-orange-500 shadow-amber-500/20 active:scale-[0.97]"
                whileTap={{ scale: 0.95 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {energy > 0 ? '🥚 Yangi tuxum' : '📺 Reklama ko\'rish'}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="egg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
            >
              {renderEgg()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ad button when no energy */}
      {energy === 0 && !showReward && (
        <motion.button
          onClick={handleWatchAd}
          disabled={loadingAd}
          className="w-full py-3.5 rounded-2xl font-bold text-white shadow-xl bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
          whileTap={{ scale: 0.97 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {loadingAd ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
              <Zap className="w-5 h-5" />
            </motion.div>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Reklama ko'rib energiya olish</span>
            </>
          )}
        </motion.button>
      )}

      {/* Info */}
      <div className="glass-card p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-muted/50">
            <p className="text-lg font-bold">3x</p>
            <p className="text-[10px] text-muted-foreground">Bosish kerak</p>
          </div>
          <div className="p-2 rounded-xl bg-muted/50">
            <p className="text-lg font-bold">1-500</p>
            <p className="text-[10px] text-muted-foreground">Tanga yutish</p>
          </div>
          <div className="p-2 rounded-xl bg-muted/50">
            <p className="text-lg font-bold">5 min</p>
            <p className="text-[10px] text-muted-foreground">Energiya</p>
          </div>
        </div>
      </div>
    </div>
  );
};
