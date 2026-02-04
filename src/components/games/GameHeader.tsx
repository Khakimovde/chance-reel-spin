import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface GameHeaderProps {
  title: string;
  icon: string;
  onBack: () => void;
}

export const GameHeader = ({ title, icon, onBack }: GameHeaderProps) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-card/80 border border-border flex items-center justify-center"
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </motion.button>
      
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
    </div>
  );
};
