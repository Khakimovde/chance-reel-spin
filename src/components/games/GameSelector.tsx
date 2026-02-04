import { motion } from 'framer-motion';

interface GameOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const games: GameOption[] = [
  { id: 'wheel', name: "G'ildirak", icon: '🎡', color: 'from-amber-400 to-orange-500' },
  { id: 'mines', name: 'Mines', icon: '💣', color: 'from-red-400 to-rose-600' },
  { id: 'box', name: 'Sandiq', icon: '🎁', color: 'from-purple-400 to-violet-600' },
];

interface GameSelectorProps {
  selectedGame: string;
  onSelectGame: (gameId: string) => void;
}

export const GameSelector = ({ selectedGame, onSelectGame }: GameSelectorProps) => {
  return (
    <div className="flex justify-center gap-3 px-4">
      {games.map((game) => (
        <motion.button
          key={game.id}
          onClick={() => onSelectGame(game.id)}
          whileTap={{ scale: 0.95 }}
          className={`relative flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all ${
            selectedGame === game.id
              ? `bg-gradient-to-br ${game.color} shadow-lg`
              : 'bg-card/80 border border-border'
          }`}
        >
          <span className="text-2xl">{game.icon}</span>
          <span className={`text-xs font-bold ${
            selectedGame === game.id ? 'text-white' : 'text-muted-foreground'
          }`}>
            {game.name}
          </span>
          {selectedGame === game.id && (
            <motion.div
              layoutId="gameIndicator"
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-full"
            />
          )}
        </motion.button>
      ))}
    </div>
  );
};
