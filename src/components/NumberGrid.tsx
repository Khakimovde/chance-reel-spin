import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { hapticFeedback } from '@/lib/telegram';
import { RotateCcw, Shuffle } from 'lucide-react';

const MAX_NUMBERS = 7;

export const NumberGrid = () => {
  const { selectedNumbers, selectNumber, clearSelection } = useGameStore();
  const numbers = Array.from({ length: 42 }, (_, i) => i + 1);

  const handleSelect = (num: number) => {
    hapticFeedback('selection');
    selectNumber(num);
  };

  const quickPick = () => {
    clearSelection();
    const quick: number[] = [];
    while (quick.length < MAX_NUMBERS) {
      const n = Math.floor(Math.random() * 42) + 1;
      if (!quick.includes(n)) quick.push(n);
    }
    quick.sort((a, b) => a - b).forEach((n) => selectNumber(n));
    hapticFeedback('medium');
  };

  return (
    <div className="space-y-4">
      {/* Selected Numbers Display - Premium Glass Card */}
      <div className="glass-card-elevated p-5">
        <p className="text-xs text-muted-foreground text-center mb-4 font-medium uppercase tracking-wide">
          Sizning Omadli Raqamlaringiz
        </p>
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: MAX_NUMBERS }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
            >
              <AnimatePresence mode="wait">
                {selectedNumbers[i] ? (
                  <motion.div
                    key={selectedNumbers[i]}
                    initial={{ scale: 0, rotate: -180, y: -30 }}
                    animate={{ scale: 1, rotate: 0, y: 0 }}
                    exit={{ scale: 0, rotate: 180, y: 30 }}
                    transition={{ type: 'spring', bounce: 0.4 }}
                    className="lottery-ball"
                  >
                    {selectedNumbers[i]}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="lottery-ball-empty"
                  >
                    <span className="text-lg">?</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          {selectedNumbers.length < MAX_NUMBERS 
            ? <span className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                Yana {MAX_NUMBERS - selectedNumbers.length} ta raqam tanlang
              </span>
            : <span className="text-success font-medium">✨ O'yinga tayyor!</span>
          }
        </p>
      </div>

      {/* Number Grid - Premium Design */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-7 gap-2">
          {numbers.map((num) => {
            const isSelected = selectedNumbers.includes(num);
            const selectionIndex = selectedNumbers.indexOf(num);
            return (
              <motion.button
                key={num}
                onClick={() => handleSelect(num)}
                className={`relative aspect-square ${isSelected ? 'number-cell-selected' : 'number-cell'}`}
                whileTap={{ scale: 0.85 }}
                layout
              >
                {num}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-[9px] font-bold text-primary shadow-md"
                  >
                    {selectionIndex + 1}
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions - Premium Buttons */}
      <div className="flex gap-3">
        <motion.button
          onClick={clearSelection}
          className="flex-1 py-3.5 px-4 rounded-xl bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw className="w-4 h-4" />
          Tozalash
        </motion.button>
        <motion.button
          onClick={quickPick}
          className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 text-sm font-semibold flex items-center justify-center gap-2 text-amber-700"
          whileTap={{ scale: 0.98 }}
        >
          <Shuffle className="w-4 h-4" />
          Tasodifiy
        </motion.button>
      </div>
    </div>
  );
};
