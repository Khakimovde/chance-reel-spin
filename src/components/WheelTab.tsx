import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { Coins, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
// Only coins: 5, 10, 30
const rewards = [
  { label: '10', sublabel: 'Tanga', icon: Coins, color: '#F59E0B', bg: 'from-amber-400 to-orange-500', value: 10, type: 'coins' },
  { label: '5', sublabel: 'Tanga', icon: Coins, color: '#22C55E', bg: 'from-green-400 to-emerald-500', value: 5, type: 'coins' },
  { label: '30', sublabel: 'Tanga', icon: Coins, color: '#EF4444', bg: 'from-red-400 to-rose-500', value: 30, type: 'coins' },
  { label: '10', sublabel: 'Tanga', icon: Coins, color: '#F59E0B', bg: 'from-amber-400 to-orange-500', value: 10, type: 'coins' },
  { label: '5', sublabel: 'Tanga', icon: Coins, color: '#22C55E', bg: 'from-green-400 to-emerald-500', value: 5, type: 'coins' },
  { label: '30', sublabel: 'Tanga', icon: Coins, color: '#EF4444', bg: 'from-red-400 to-rose-500', value: 30, type: 'coins' },
  { label: '10', sublabel: 'Tanga', icon: Coins, color: '#F59E0B', bg: 'from-amber-400 to-orange-500', value: 10, type: 'coins' },
  { label: '5', sublabel: 'Tanga', icon: Coins, color: '#22C55E', bg: 'from-green-400 to-emerald-500', value: 5, type: 'coins' },
];

const segmentColors = [
  '#FEF3C7', '#D1FAE5', '#FEE2E2', '#FEF3C7',
  '#D1FAE5', '#FEE2E2', '#FEF3C7', '#D1FAE5'
];

const segmentBorders = [
  '#F59E0B', '#22C55E', '#EF4444', '#F59E0B',
  '#22C55E', '#EF4444', '#F59E0B', '#22C55E'
];

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const WheelTab = () => {
  const { addCoins, recordWheelSpin, canSpinWheel, getWheelResetTime } = useGameStore();
  const { user, refreshUserData } = useTelegram();
  const [isSpinning, setIsSpinning] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [result, setResult] = useState<typeof rewards[0] | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Ref to prevent double-click
  const isProcessingRef = useRef(false);

  const canSpin = canSpinWheel();

  // Preload ad SDK
  useEffect(() => {
    loadAdSdk();
  }, []);

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      if (canSpin) {
        setTimeRemaining(0);
        return;
      }
      const resetTime = getWheelResetTime();
      const remaining = resetTime.getTime() - Date.now();
      setTimeRemaining(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [canSpin, getWheelResetTime]);

  const handleSpin = async () => {
    // Prevent double-click with ref
    if (isProcessingRef.current || isSpinning || isLoadingAd) return;
    isProcessingRef.current = true;

    // If can't spin, show the timer
    if (!canSpin) {
      hapticFeedback('warning');
      isProcessingRef.current = false;
      return;
    }

    // Step 1: Show ad first
    hapticFeedback('medium');
    setIsLoadingAd(true);
    
    try {
      const adShown = await showAd();
      setIsLoadingAd(false);
      
      if (!adShown) {
        isProcessingRef.current = false;
        return;
      }
      
      // Step 2: After ad completes, start spinning
      startSpinning();
    } catch (error) {
      console.error('Error showing ad:', error);
      setIsLoadingAd(false);
      isProcessingRef.current = false;
    }
  };

  const startSpinning = () => {
    setIsSpinning(true);
    setResult(null);
    setShowCelebration(false);

    const winIndex = Math.floor(Math.random() * rewards.length);
    const segmentAngle = 360 / rewards.length;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = rotation + (extraSpins * 360) + (360 - winIndex * segmentAngle - segmentAngle / 2);

    setRotation(targetRotation);

    setTimeout(async () => {
      setIsSpinning(false);
      setResult(rewards[winIndex]);
      setShowCelebration(true);
      recordWheelSpin();
      hapticFeedback('success');
      
      // Reset processing ref after spin completes
      isProcessingRef.current = false;

      // Add coins to backend
      const reward = rewards[winIndex];
      try {
        const { error } = await supabase.functions.invoke('update-coins', {
          body: { 
            telegramId: user?.id, 
            amount: reward.value,
            source: 'wheel',
            updateStats: 'wheel'
          }
        });
        
        if (error) {
          console.error('Error updating coins:', error);
          toast.error('Balans yangilashda xatolik');
        } else {
          // Refresh user data to get updated balance
          await refreshUserData();
          addCoins(reward.value);
        }
      } catch (err) {
        console.error('Error:', err);
        addCoins(reward.value); // Fallback to local
      }
    }, 5000);
  };

  return (
    <div className="space-y-6 pb-4 relative overflow-hidden">
      {/* Header */}
      <div className="text-center relative z-10">
        <motion.h1 className="text-2xl font-bold text-foreground">
          🎡 Omad G'ildiragi
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-1">Aylantiring va yutib oling!</p>
      </div>

      {/* Wheel Container */}
      <div className="relative flex justify-center items-center py-4">
        {/* Outer decorative ring */}
        <div className="absolute w-[320px] h-[320px] rounded-full bg-gradient-to-br from-amber-100 via-white to-green-100 shadow-lg" />
        
        {/* Decorative dots around wheel */}
        {[...Array(24)].map((_, i) => {
          const angle = (360 / 24) * i;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + 48 * Math.cos(rad);
          const y = 50 + 48 * Math.sin(rad);
          return (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{
                left: `calc(50% + ${(x - 50) * 3.2}px)`,
                top: `calc(50% + ${(y - 50) * 3.2}px)`,
                backgroundColor: i % 3 === 0 ? '#F59E0B' : i % 3 === 1 ? '#22C55E' : '#EF4444',
              }}
              animate={{ 
                opacity: isSpinning ? [0.4, 1, 0.4] : [0.6, 1, 0.6],
                scale: isSpinning ? [0.9, 1.2, 0.9] : 1
              }}
              transition={{ 
                duration: 0.4, 
                repeat: Infinity, 
                delay: i * 0.03 
              }}
            />
          );
        })}

        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <motion.div 
            animate={isSpinning ? { y: [0, 6, 0] } : {}}
            transition={{ duration: 0.2, repeat: Infinity }}
            className="relative"
          >
            <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[32px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full shadow-md" />
          </motion.div>
        </div>

        {/* Main Wheel */}
        <div className="relative w-[300px] h-[300px]">
          {/* Wheel border */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 shadow-xl" />
          
          <motion.div
            className="absolute inset-2 rounded-full overflow-hidden shadow-inner"
            style={{ rotate: rotation }}
            animate={{ rotate: rotation }}
            transition={{ 
              duration: 5, 
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            {/* Wheel segments */}
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {rewards.map((reward, i) => {
                const angle = (360 / rewards.length);
                const startAngle = i * angle - 90;
                const endAngle = startAngle + angle;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const x1 = 100 + 100 * Math.cos(startRad);
                const y1 = 100 + 100 * Math.sin(startRad);
                const x2 = 100 + 100 * Math.cos(endRad);
                const y2 = 100 + 100 * Math.sin(endRad);
                const largeArc = angle > 180 ? 1 : 0;

                return (
                  <g key={i}>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={segmentColors[i]}
                      stroke={segmentBorders[i]}
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Icons on segments */}
            {rewards.map((reward, i) => {
              const angle = (360 / rewards.length) * i + (360 / rewards.length) / 2 - 90;
              const rad = (angle * Math.PI) / 180;
              const x = 50 + 32 * Math.cos(rad);
              const y = 50 + 32 * Math.sin(rad);
              const Icon = reward.icon;

              return (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                  }}
                >
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: reward.color + '20' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: reward.color }} />
                  </div>
                  <span className="text-[9px] font-bold mt-0.5" style={{ color: reward.color }}>
                    {reward.label}
                  </span>
                </div>
              );
            })}
          </motion.div>

          {/* Center button - clean design without logo */}
          <motion.button
            onClick={handleSpin}
            disabled={isSpinning || isLoadingAd || !canSpin}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full z-10 focus:outline-none"
            whileHover={!isSpinning && !isLoadingAd && canSpin ? { scale: 1.08 } : {}}
            whileTap={!isSpinning && !isLoadingAd && canSpin ? { scale: 0.95 } : {}}
          >
            <div className={`w-full h-full rounded-full flex flex-col items-center justify-center border-4 border-white shadow-xl ${
              isLoadingAd 
                ? 'bg-gray-400' 
                : !canSpin
                  ? 'bg-gray-400'
                  : 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600'
            }`}>
              {isLoadingAd ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : isSpinning ? (
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="text-2xl"
                  >
                    🎰
                  </motion.div>
                </div>
              ) : (
                <span className="text-xs font-black text-white drop-shadow-md text-center leading-tight">
                  {canSpin ? 'BOSISH' : 'KUTISH'}
                </span>
              )}
            </div>
          </motion.button>
        </div>
      </div>

      {/* Timer - Show when can't spin */}
      {!canSpin && timeRemaining > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-1.5 text-muted-foreground"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Keyingi: {formatTimeRemaining(timeRemaining)}</span>
        </motion.div>
      )}

      {/* Result Celebration - Centered Modal */}
      <AnimatePresence>
        {result && showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', bounce: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-3xl p-8 text-center space-y-5 relative overflow-hidden shadow-2xl"
            >
              {/* Sparkles background */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-xl"
                    initial={{ 
                      x: Math.random() * 100 + '%', 
                      y: '100%', 
                      opacity: 0 
                    }}
                    animate={{ 
                      y: '-20%', 
                      opacity: [0, 1, 0],
                      rotate: Math.random() * 360
                    }}
                    transition={{ 
                      duration: 2.5, 
                      delay: Math.random() * 0.5,
                      repeat: Infinity
                    }}
                  >
                    {['✨', '🎉', '⭐', '🌟'][Math.floor(Math.random() * 4)]}
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
                className={`w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br ${result.bg} flex items-center justify-center shadow-xl`}
              >
                <result.icon className="w-12 h-12 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-lg text-muted-foreground">🎊 Tabriklaymiz!</p>
                <p className="text-4xl font-black mt-3 text-foreground">
                  +{result.label} {result.sublabel}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Balansga qo'shildi!</p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => setShowCelebration(false)}
                className="w-full py-4 rounded-2xl gradient-primary text-white font-bold shadow-lg text-lg"
              >
                Ajoyib! 🎊
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin instruction */}
      {!result && !isSpinning && canSpin && (
        <motion.div 
          className="text-center"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <p className="text-sm text-muted-foreground">
            👆 Markazni bosing va aylantiring!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            (1 ta reklama ko'rib aylantiring)
          </p>
        </motion.div>
      )}
    </div>
  );
};
