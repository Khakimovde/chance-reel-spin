import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownTimer } from './CountdownTimer';
import { NumberGrid } from './NumberGrid';
import { TrustBadge } from './TrustBadge';
import { LotteryBallMachine } from './LotteryBallMachine';
import { useGameStore, getNextDrawSlot } from '@/store/gameStore';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { formatDrawTime, generateDrawNumbers, getRewardForMatches } from '@/lib/drawService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { Play, Trophy, X, Sparkles, Loader2, Clock, Check } from 'lucide-react';

const MAX_NUMBERS = 7;

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '00:00';
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const seconds = Math.floor((ms / 1000) % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const LotteryTab = () => {
  const { 
    selectedNumbers, 
    pendingParticipation,
    addCoins, 
    addWinnings, 
    clearSelection, 
    addDrawResult,
    setPendingParticipation,
    updatePersistentStats,
  } = useGameStore();
  
  const { user, refreshUserData } = useTelegram();
  
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [isWaitingForDraw, setIsWaitingForDraw] = useState(false);
  const [timeUntilDraw, setTimeUntilDraw] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [activeDrawTime, setActiveDrawTime] = useState<Date | null>(null);
  
  // Ref to track if draw has been triggered for current participation
  const drawTriggeredRef = useRef(false);
  
  const isReady = selectedNumbers.length === MAX_NUMBERS;

  // Preload ad SDK
  useEffect(() => {
    loadAdSdk();
  }, []);

  // Handle pending participation countdown and auto-draw
  useEffect(() => {
    if (!pendingParticipation) {
      setIsWaitingForDraw(false);
      setTimeUntilDraw(0);
      drawTriggeredRef.current = false;
      return;
    }

    const getTargetMs = () => {
      // The drawTime is the target time when the draw happens
      const anyDrawTime = pendingParticipation.drawTime as unknown;
      if (typeof anyDrawTime === 'string') {
        const ms = new Date(anyDrawTime).getTime();
        return Number.isFinite(ms) ? ms : null;
      }
      if (anyDrawTime instanceof Date) return anyDrawTime.getTime();
      
      // Fallback: parse from slot and add 15 min
      const fromSlot = Number.parseInt(pendingParticipation.drawSlot.replace('draw_', ''), 10);
      if (Number.isFinite(fromSlot) && fromSlot > 0) {
        return fromSlot + (15 * 60 * 1000);
      }
      return null;
    };

    const tick = () => {
      const targetMs = getTargetMs();
      if (!targetMs) return;

      const left = targetMs - Date.now();
      setTimeUntilDraw(Math.max(0, left));

      // When time is up, trigger the draw (only once)
      if (left <= 0 && !drawTriggeredRef.current && !isDrawing && !showResult) {
        drawTriggeredRef.current = true;
        startAutoDraw(targetMs);
        return;
      }

      if (!isDrawing && !showResult) {
        setIsWaitingForDraw(true);
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [pendingParticipation, isDrawing, showResult]);

  const joinDraw = async () => {
    if (!isReady) return;
    
    hapticFeedback('medium');
    setIsLoadingAd(true);
    
    // Show ad before joining (replaces ticket system)
    const adShown = await showAd();
    setIsLoadingAd(false);
    
    if (!adShown) return;

    // Get the NEXT draw slot time (not current!)
    // This is critical: we always assign to the NEXT upcoming draw
    const nextDrawTime = getNextDrawSlot();
    const nextDrawSlotId = `draw_${nextDrawTime.getTime()}`;
    
    setPendingParticipation({
      selectedNumbers: [...selectedNumbers],
      drawSlot: nextDrawSlotId,
      drawTime: nextDrawTime
    });
    
    setIsWaitingForDraw(true);
    drawTriggeredRef.current = false;
    hapticFeedback('success');
  };

  const startAutoDraw = (drawTimestampMs: number) => {
    if (!pendingParticipation) return;
    
    setIsWaitingForDraw(false);
    setIsDrawing(true);
    
    // The draw time is the target time from pendingParticipation
    const drawTime = new Date(drawTimestampMs);
    setActiveDrawTime(drawTime);
    
    // Generate numbers deterministically based on draw time (same for all users)
    const draw = generateDrawNumbers(drawTime, MAX_NUMBERS, 42);
    setDrawnNumbers(draw);
  };

  const handleBallDrawn = (number: number, index: number) => {
    hapticFeedback('light');
  };

  const handleDrawComplete = async () => {
    if (!pendingParticipation) return;
    
    setIsDrawing(false);
    setShowResult(true);
    
    const participatedNumbers = pendingParticipation.selectedNumbers;
    const matches = participatedNumbers.filter((n) => drawnNumbers.includes(n)).length;
    const reward = getRewardForMatches(matches);

    const drawTime = activeDrawTime ?? new Date();
    
    // Save to backend
    if (user?.id) {
      try {
        await supabase.functions.invoke('save-game-result', {
          body: {
            telegramId: user.id,
            selectedNumbers: participatedNumbers,
            drawnNumbers: drawnNumbers,
            drawSlot: pendingParticipation.drawSlot,
            drawTime: drawTime.toISOString(),
          }
        });
        
        // Refresh user data to get updated coins/winnings
        await refreshUserData();
      } catch (error) {
        console.error('Error saving game result:', error);
      }
    }
    
    // Add to local history
    addDrawResult({
      id: pendingParticipation.drawSlot,
      time: formatDrawTime(drawTime),
      drawnNumbers: drawnNumbers,
      userParticipation: {
        drawTime: drawTime.toISOString(),
        selectedNumbers: participatedNumbers,
        drawnNumbers: drawnNumbers,
        matches,
        reward
      }
    });
    
    // Update persistent stats
    updatePersistentStats(true, matches >= 3, reward);
    
    // Add winnings locally (backend already updated)
    addWinnings(reward);
    
    if (matches >= 3) {
      hapticFeedback('success');
    }
    
    // Clear pending
    setPendingParticipation(null);
    setActiveDrawTime(null);
  };

  const participatedNumbers = pendingParticipation?.selectedNumbers || selectedNumbers;
  const matches = participatedNumbers.filter((n) => drawnNumbers.includes(n)).length;
  const currentReward = getRewardForMatches(matches);

  const closeResult = () => {
    setShowResult(false);
    setDrawnNumbers([]);
    setActiveDrawTime(null);
    clearSelection();
    drawTriggeredRef.current = false;
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🎰 Omadli Lotereya
          </h1>
          <p className="text-sm text-muted-foreground">42 ta raqamdan 7 tasini tanlang</p>
        </div>
        <TrustBadge variant="fair" />
      </div>

      <CountdownTimer />

      {/* Waiting for Draw State */}
      {isWaitingForDraw && pendingParticipation && !isDrawing && !showResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-elevated p-6 text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <Check className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-foreground">Siz qatnashyapsiz!</h3>
            <p className="text-sm text-muted-foreground mt-1">O'yin avtomatik boshlanadi</p>
          </div>

          <div className="bg-muted/50 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-3">Sizning raqamlaringiz:</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {pendingParticipation.selectedNumbers.map((num, i) => (
                <motion.span 
                  key={num} 
                  className="lottery-ball text-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {num}
                </motion.span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            <span className="text-2xl font-bold">{formatTimeRemaining(timeUntilDraw)}</span>
          </div>
          <p className="text-xs text-muted-foreground">O'yin boshlanishiga qoldi</p>
        </motion.div>
      )}

      {!isDrawing && !showResult && !isWaitingForDraw && <NumberGrid />}

      {/* Drawing Animation */}
      <AnimatePresence>
        {isDrawing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card-elevated p-6 text-center space-y-4 relative overflow-hidden"
          >
            <motion.p 
              className="text-xl font-bold relative z-10 text-foreground"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              🎱 Raqamlar chiqarilmoqda...
            </motion.p>

            <LotteryBallMachine
              targetNumbers={drawnNumbers}
              onBallDrawn={handleBallDrawn}
              onComplete={handleDrawComplete}
              maxNumbers={MAX_NUMBERS}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card-elevated p-6 space-y-5 relative overflow-hidden"
          >
            {/* Celebration particles for wins */}
            {matches >= 3 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(25)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-xl"
                    initial={{ x: '50%', y: '100%', opacity: 0 }}
                    animate={{ 
                      x: `${Math.random() * 100}%`,
                      y: `-20%`,
                      opacity: [0, 1, 0],
                      rotate: Math.random() * 360
                    }}
                    transition={{ 
                      duration: 2 + Math.random(),
                      delay: Math.random() * 0.5,
                      repeat: Infinity
                    }}
                  >
                    {['🎉', '✨', '🌟', '💫', '🎊', '⭐'][Math.floor(Math.random() * 6)]}
                  </motion.div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Trophy className="w-6 h-6 text-amber-500" />
                Natijalar
              </h3>
              <button onClick={closeResult} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4 relative z-10">
              {/* Drawn Numbers */}
              <div className="bg-muted/50 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-3 text-center font-medium">🎱 Yutgan Raqamlar</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {drawnNumbers.map((num, i) => (
                    <motion.span 
                      key={num} 
                      className="lottery-ball text-sm"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      {num}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Your Numbers with match highlighting */}
              <div className="bg-muted/50 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-3 text-center font-medium">🎯 Sizning Raqamlaringiz</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {participatedNumbers.map((num, i) => {
                    const isMatch = drawnNumbers.includes(num);
                    return (
                      <motion.span
                        key={num}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${
                          isMatch 
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {num}
                      </motion.span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Result Banner */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1 }}
              className={`p-5 rounded-2xl text-center relative z-10 ${
                matches >= 3 
                  ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200' 
                  : 'bg-muted'
              }`}
            >
              <motion.p 
                className="text-4xl font-black text-foreground"
                animate={matches >= 3 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {matches} / {MAX_NUMBERS}
              </motion.p>
              <p className="text-sm text-muted-foreground">To'g'ri topildi</p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="mt-3"
              >
                <p className={`text-2xl font-bold ${matches >= 3 ? 'text-amber-600' : 'text-primary'}`}>
                  🎉 +{currentReward} Tanga!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {matches >= 3 ? 'Tabriklaymiz, ajoyib natija!' : 'Rahmat qatnashganingiz uchun!'}
                </p>
              </motion.div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              onClick={closeResult}
              className="w-full py-4 rounded-2xl gradient-primary text-white font-bold flex items-center justify-center gap-2 relative z-10 shadow-md"
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles className="w-5 h-5" />
              Yana O'ynash
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Draw Button - No tickets required, just watch ad */}
      {!isDrawing && !showResult && !isWaitingForDraw && (
        <div className="space-y-2">
          <motion.button
            onClick={joinDraw}
            disabled={!isReady || isLoadingAd}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-base ${
              isReady && !isLoadingAd
                ? 'gradient-gold text-white shadow-lg'
                : 'bg-muted text-muted-foreground'
            }`}
            whileTap={isReady && !isLoadingAd ? { scale: 0.98 } : {}}
            animate={isReady && !isLoadingAd ? { 
              boxShadow: [
                '0 4px 20px rgba(245, 158, 11, 0.3)', 
                '0 4px 30px rgba(245, 158, 11, 0.5)', 
                '0 4px 20px rgba(245, 158, 11, 0.3)'
              ] 
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isLoadingAd ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Yuklanmoqda...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                {isReady ? `O'ynash (1 reklama)` : `Yana ${MAX_NUMBERS - selectedNumbers.length} ta tanlang`}
              </>
            )}
          </motion.button>
          
          {/* Reward info */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Mukofotlar:</p>
            <p className="text-[10px] text-muted-foreground">
              0-2 tog'ri: 10-30 • 3-4 tog'ri: 40-50 • 5-6 tog'ri: 60-70 • 7 tog'ri: 1000 tanga
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
