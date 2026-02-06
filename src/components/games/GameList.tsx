import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GameSetting {
  id: string;
  game_id: string;
  game_name: string;
  icon: string;
  is_enabled: boolean;
  gradient: string;
  description: string | null;
}

interface GameListProps {
  onSelectGame: (gameId: string) => void;
}

export const GameList = ({ onSelectGame }: GameListProps) => {
  const [games, setGames] = useState<GameSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('game_settings')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error fetching games:', error);
      // Fallback to default games
      setGames([
        { id: '1', game_id: 'wheel', game_name: "G'ildirak", icon: '🎡', is_enabled: true, gradient: 'from-amber-400 to-orange-500', description: "Omadingizni sinab ko'ring!" },
        { id: '2', game_id: 'mines', game_name: 'Mines', icon: '💣', is_enabled: true, gradient: 'from-red-400 to-rose-600', description: 'Bombalardan qoching!' },
        { id: '3', game_id: 'box', game_name: 'Sandiq', icon: '🎁', is_enabled: true, gradient: 'from-purple-400 to-violet-600', description: '9 ta sandiqdan birini tanlang!' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4">
      <h2 className="text-lg font-bold text-foreground text-center mb-4">🎮 AR games</h2>
      
      {games.map((game, index) => (
        <motion.button
          key={game.game_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => game.is_enabled && onSelectGame(game.game_id)}
          disabled={!game.is_enabled}
          whileTap={game.is_enabled ? { scale: 0.98 } : undefined}
          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors relative overflow-hidden ${
            game.is_enabled 
              ? 'bg-card/80 border-border hover:bg-card cursor-pointer' 
              : 'bg-muted/50 border-muted cursor-not-allowed'
          }`}
        >
          {/* Disabled overlay */}
          {!game.is_enabled && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Tez orada</span>
              </div>
            </div>
          )}
          
          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center shadow-lg ${!game.is_enabled ? 'opacity-50' : ''}`}>
            <span className="text-2xl">{game.icon}</span>
          </div>
          
          {/* Info */}
          <div className="flex-1 text-left">
            <h3 className={`font-bold ${game.is_enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{game.game_name}</h3>
            <p className="text-xs text-muted-foreground">{game.description}</p>
          </div>
          
          {/* Arrow */}
          {game.is_enabled && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
        </motion.button>
      ))}
    </div>
  );
};
