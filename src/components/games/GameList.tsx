import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface GameOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  gradient: string;
}

const games: GameOption[] = [
  { 
    id: 'wheel', 
    name: "G'ildirak", 
    icon: '🎡', 
    description: "Omadingizni sinab ko'ring!",
    gradient: 'from-amber-400 to-orange-500' 
  },
  { 
    id: 'mines', 
    name: 'Mines', 
    icon: '💣', 
    description: "Bombalardan qoching!",
    gradient: 'from-red-400 to-rose-600' 
  },
  { 
    id: 'box', 
    name: 'Sandiq', 
    icon: '🎁', 
    description: "9 ta sandiqdan birini tanlang!",
    gradient: 'from-purple-400 to-violet-600' 
  },
];

interface GameListProps {
  onSelectGame: (gameId: string) => void;
}

export const GameList = ({ onSelectGame }: GameListProps) => {
  return (
    <div className="space-y-3 px-4">
      <h2 className="text-lg font-bold text-foreground text-center mb-4">🎮 O'yinlar</h2>
      
      {games.map((game, index) => (
        <motion.button
          key={game.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onSelectGame(game.id)}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card/80 border border-border hover:bg-card transition-colors"
        >
          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg`}>
            <span className="text-2xl">{game.icon}</span>
          </div>
          
          {/* Info */}
          <div className="flex-1 text-left">
            <h3 className="font-bold text-foreground">{game.name}</h3>
            <p className="text-xs text-muted-foreground">{game.description}</p>
          </div>
          
          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </motion.button>
      ))}
    </div>
  );
};
