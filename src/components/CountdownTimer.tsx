import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { getNextDrawSlot } from '@/store/gameStore';

export const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const nextDraw = getNextDrawSlot();
      const now = new Date();
      const diff = nextDraw.getTime() - now.getTime();
      
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ minutes: Math.max(0, minutes), seconds: Math.max(0, seconds) });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-elevated p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <Timer className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Keyingi O'yin</p>
          <p className="text-sm font-semibold text-foreground">Har 15 daqiqada</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <TimeUnit value={timeLeft.minutes} label="d" />
        <motion.span 
          className="text-2xl font-bold text-primary"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          :
        </motion.span>
        <TimeUnit value={timeLeft.seconds} label="s" />
      </div>
    </motion.div>
  );
};

const TimeUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="bg-muted rounded-xl px-3 py-2 min-w-[52px] text-center">
    <motion.span 
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="text-2xl font-bold text-foreground inline-block"
    >
      {value.toString().padStart(2, '0')}
    </motion.span>
    <span className="text-xs text-muted-foreground ml-0.5">{label}</span>
  </div>
);