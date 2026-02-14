import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';

interface Participant {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  is_winner: boolean;
  reward: number;
}

const getAvatar = (p: Participant) =>
  p.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name || p.telegram_id}`;
const getName = (p: Participant) => p.first_name || p.username || `User ${p.telegram_id}`;

export const BattleParticipants = ({ participants }: { participants: Participant[] }) => {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? participants : participants.slice(0, 10);

  if (participants.length === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          Qatnashchilar
        </h3>
        <span className="text-xs font-bold bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full">
          {participants.length} kishi
        </span>
      </div>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {display.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="relative">
                <img src={getAvatar(p)} alt="" className="w-9 h-9 rounded-full ring-2 ring-border" />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background text-[8px] flex items-center justify-center">⚔️</span>
              </div>
              <span className="text-sm font-medium flex-1 truncate">{getName(p)}</span>
              <span className="text-[10px] text-muted-foreground font-medium">#{i + 1}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {participants.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          {showAll ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Yopish</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Barchani ko'rish ({participants.length})</>
          )}
        </button>
      )}
    </div>
  );
};
