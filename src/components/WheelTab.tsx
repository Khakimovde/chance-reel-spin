import { useState } from 'react';
import { GameList } from './games/GameList';
import { GameHeader } from './games/GameHeader';
import { WheelGame } from './games/WheelGame';
import { MinesGame } from './games/MinesGame';
import { MysteryBoxGame } from './games/MysteryBoxGame';
import { motion, AnimatePresence } from 'framer-motion';

type GameId = 'wheel' | 'mines' | 'box' | null;

const gameInfo = {
  wheel: { title: "G'ildirak", icon: '🎡' },
  mines: { title: 'Mines', icon: '💣' },
  box: { title: 'Sandiq', icon: '🎁' },
};

export const WheelTab = () => {
  const [selectedGame, setSelectedGame] = useState<GameId>(null);

  const handleBack = () => {
    setSelectedGame(null);
  };

  return (
    <div className="pb-4">
      <AnimatePresence mode="wait">
        {selectedGame === null ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <GameList onSelectGame={(id) => setSelectedGame(id as GameId)} />
          </motion.div>
        ) : (
          <motion.div
            key={selectedGame}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <GameHeader
              title={gameInfo[selectedGame].title}
              icon={gameInfo[selectedGame].icon}
              onBack={handleBack}
            />
            
            {selectedGame === 'wheel' && <WheelGame />}
            {selectedGame === 'mines' && <MinesGame />}
            {selectedGame === 'box' && <MysteryBoxGame />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
