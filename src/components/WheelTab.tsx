import { useState } from 'react';
import { GameSelector } from './games/GameSelector';
import { WheelGame } from './games/WheelGame';
import { MinesGame } from './games/MinesGame';
import { MysteryBoxGame } from './games/MysteryBoxGame';
import { motion, AnimatePresence } from 'framer-motion';

export const WheelTab = () => {
  const [selectedGame, setSelectedGame] = useState('wheel');

  return (
    <div className="space-y-4 pb-4">
      {/* Game Selector */}
      <GameSelector 
        selectedGame={selectedGame} 
        onSelectGame={setSelectedGame} 
      />

      {/* Game Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedGame}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {selectedGame === 'wheel' && <WheelGame />}
          {selectedGame === 'mines' && <MinesGame />}
          {selectedGame === 'box' && <MysteryBoxGame />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
