import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Bomb, Diamond, Loader2, Settings } from 'lucide-react';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGameStore } from '@/store/gameStore';

const GRID_SIZE = 16; // 4x4 grid
const BET_OPTIONS = [10, 25, 50, 100];
const BOMB_OPTIONS = [3, 4, 5, 6];

// Multiplier based on revealed cells and bomb count
const getMultiplier = (cellsRevealed: number, bombCount: number): number => {
  // More bombs = higher multiplier per reveal
  const baseMultipliers: Record<number, number[]> = {
    3: [1.0, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.1, 2.4, 2.7, 3.0, 3.5, 4.0],
    4: [1.0, 1.15, 1.3, 1.5, 1.7, 2.0, 2.3, 2.7, 3.1, 3.6, 4.2, 5.0],
    5: [1.0, 1.2, 1.45, 1.75, 2.1, 2.5, 3.0, 3.6, 4.3, 5.2, 6.0],
    6: [1.0, 1.3, 1.65, 2.1, 2.7, 3.4, 4.3, 5.4, 6.8, 8.5],
  };
  const multipliers = baseMultipliers[bombCount] || baseMultipliers[4];
  return multipliers[Math.min(cellsRevealed, multipliers.length - 1)];
};

interface Cell {
  id: number;
  revealed: boolean;
  isBomb: boolean;
}

export const MinesGame = () => {
  const { user, refreshUserData } = useTelegram();
  const addCoins = useGameStore((s) => s.addCoins);
  const removeCoins = useGameStore((s) => s.removeCoins);
  const [betAmount, setBetAmount] = useState(BET_OPTIONS[0]);
  const [bombCount, setBombCount] = useState(4);
  const [cells, setCells] = useState<Cell[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalWin, setFinalWin] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const processedRef = useRef(false);

  const userCoins = user?.coins || 0;

  useEffect(() => {
    loadAdSdk();
  }, []);

  const initializeGame = () => {
    const bombPositions = new Set<number>();
    while (bombPositions.size < bombCount) {
      bombPositions.add(Math.floor(Math.random() * GRID_SIZE));
    }

    const newCells: Cell[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
      id: i,
      revealed: false,
      isBomb: bombPositions.has(i),
    }));

    setCells(newCells);
    setRevealedCount(0);
    setCurrentMultiplier(1.0);
    setGameOver(false);
    setWon(false);
    setShowResult(false);
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
        body: { telegramId: user?.id, amount: -betAmount, source: 'mines_bet' }
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

  const revealCell = (cellId: number) => {
    if (gameOver || cells[cellId].revealed) return;

    hapticFeedback('light');
    
    const newCells = [...cells];
    newCells[cellId].revealed = true;
    setCells(newCells);

    if (newCells[cellId].isBomb) {
      hapticFeedback('error');
      const revealedCells = newCells.map(c => ({ ...c, revealed: true }));
      setCells(revealedCells);
      setGameOver(true);
      setWon(false);
      setShowResult(true);
      setFinalWin(0);
      return;
    }

    const newRevealedCount = revealedCount + 1;
    setRevealedCount(newRevealedCount);
    setCurrentMultiplier(getMultiplier(newRevealedCount, bombCount));
  };

  const cashOut = async () => {
    if (gameOver || revealedCount === 0 || processedRef.current) return;
    
    processedRef.current = true;
    setIsLoading(true);
    hapticFeedback('success');

    const winAmount = Math.floor(betAmount * currentMultiplier);
    
    // Optimistic update
    addCoins(winAmount);
    
    try {
      const { error } = await supabase.functions.invoke('update-coins', {
        body: { telegramId: user?.id, amount: winAmount, source: 'mines_win' }
      });

      if (error) {
        removeCoins(winAmount);
        toast.error("Yutukni olishda xatolik");
      }

      refreshUserData();
      
      setGameOver(true);
      setWon(true);
      setFinalWin(winAmount);
      setShowResult(true);
      
      const revealedCells = cells.map(c => ({ ...c, revealed: true }));
      setCells(revealedCells);
    } catch (err) {
      console.error(err);
      removeCoins(winAmount);
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsLoading(false);
      processedRef.current = false;
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setCells([]);
    setRevealedCount(0);
    setCurrentMultiplier(1.0);
    setShowResult(false);
    setFinalWin(0);
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
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
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

          {/* Bomb Settings */}
          <div className="bg-card/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bomb className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Bomba soni:</span>
              </div>
              <span className="font-bold text-red-500">{bombCount}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {BOMB_OPTIONS.map((count) => (
                <motion.button
                  key={count}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setBombCount(count)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    bombCount === count
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {count}
                </motion.button>
              ))}
            </div>

            <div className="text-center text-xs text-muted-foreground">
              Ko'p bomba = yuqori koeffitsient 🎯
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={startGame}
            disabled={isLoading || userCoins < betAmount}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-lg shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>🎮</span> O'yinni Boshlash</>}
          </motion.button>

          <p className="text-center text-xs text-muted-foreground">(1 ta reklama ko'rib o'ynaysiz)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="flex justify-between items-center bg-card/50 rounded-xl p-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Tikish</p>
              <p className="font-bold text-foreground">{betAmount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Bomba</p>
              <p className="font-bold text-red-500">{bombCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Koeffitsient</p>
              <p className="font-bold text-green-500">{currentMultiplier.toFixed(2)}x</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Yutuk</p>
              <p className="font-bold text-amber-500">{Math.floor(betAmount * currentMultiplier)}</p>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-4 gap-2">
            {cells.map((cell) => (
              <motion.button
                key={cell.id}
                whileTap={!cell.revealed && !gameOver ? { scale: 0.9 } : {}}
                onClick={() => revealCell(cell.id)}
                disabled={cell.revealed || gameOver}
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
                  cell.revealed
                    ? cell.isBomb
                      ? 'bg-red-500/80 shadow-inner'
                      : 'bg-green-500/80 shadow-inner'
                    : 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg hover:from-slate-600 hover:to-slate-700'
                }`}
              >
                {cell.revealed ? (
                  cell.isBomb ? <Bomb className="w-6 h-6 text-white" /> : <Diamond className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-slate-500">?</span>
                )}
              </motion.button>
            ))}
          </div>

          {/* Action buttons */}
          {!gameOver && (
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={resetGame}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold"
              >
                Bekor qilish
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={cashOut}
                disabled={revealedCount === 0 || isLoading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Olish ({Math.floor(betAmount * currentMultiplier)})</>}
              </motion.button>
            </div>
          )}

          {gameOver && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetGame}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold"
            >
              Qayta O'ynash
            </motion.button>
          )}
        </div>
      )}

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
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
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                won ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-red-400 to-rose-600'
              }`}>
                {won ? <Diamond className="w-10 h-10 text-white" /> : <Bomb className="w-10 h-10 text-white" />}
              </div>

              <div>
                <p className="text-lg text-muted-foreground">{won ? '🎉 Tabriklaymiz!' : '💥 Bomba!'}</p>
                <p className="text-3xl font-black mt-2 text-foreground">{won ? `+${finalWin} Tanga` : "Yutkizdingiz"}</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { setShowResult(false); resetGame(); }}
                className={`w-full py-4 rounded-2xl text-white font-bold ${
                  won ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'
                }`}
              >
                {won ? 'Ajoyib! 🎊' : 'Qayta Urinish'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
