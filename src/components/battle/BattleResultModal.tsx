import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Frown, Sparkles, X } from 'lucide-react';

interface BattleResultModalProps {
  isOpen: boolean;
  isWinner: boolean;
  reward: number;
  onClose: () => void;
}

export const BattleResultModal = ({ isOpen, isWinner, reward, onClose }: BattleResultModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-sm rounded-3xl p-8 text-center overflow-hidden ${
              isWinner
                ? 'bg-gradient-to-b from-emerald-500 to-green-600'
                : 'bg-gradient-to-b from-orange-500 to-red-500'
            }`}
          >
            {/* Close */}
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: 40 + Math.random() * 60,
                    height: 40 + Math.random() * 60,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                />
              ))}
            </div>

            <div className="relative z-10 space-y-4">
              {/* Icon */}
              <motion.div
                animate={isWinner ? { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] } : { y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                className="mx-auto w-20 h-20 rounded-full bg-white/20 flex items-center justify-center"
              >
                {isWinner ? (
                  <Trophy className="w-10 h-10 text-yellow-200" />
                ) : (
                  <Frown className="w-10 h-10 text-white/90" />
                )}
              </motion.div>

              {/* Title */}
              <div>
                <h2 className="text-2xl font-black text-white">
                  {isWinner ? '🎉 Tabriklaymiz!' : '😔 Omad kulmadi'}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  {isWinner ? 'Siz g\'olib bo\'ldingiz!' : 'Keyingi safar omad kulib boqadi!'}
                </p>
              </div>

              {/* Reward */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-3"
              >
                <Sparkles className="w-5 h-5 text-yellow-200" />
                <span className="text-3xl font-black text-white">+{reward}</span>
                <span className="text-lg">🪙</span>
              </motion.div>

              {/* Message */}
              <p className="text-white/70 text-xs">
                {isWinner
                  ? 'Tangalar balansingizga qo\'shildi!'
                  : 'Ishtirok uchun 40 tanga berildi. Yana urinib ko\'ring!'}
              </p>

              {/* Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-white/25 backdrop-blur-sm text-white font-bold text-sm hover:bg-white/30 transition-colors"
              >
                {isWinner ? 'Ajoyib! ✨' : 'Yana urinib ko\'rish ⚔️'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
