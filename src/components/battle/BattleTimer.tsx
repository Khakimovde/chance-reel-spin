import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';

interface BattleTimerProps {
  minutes: number;
  seconds: number;
}

export const BattleTimer = ({ minutes, seconds }: BattleTimerProps) => (
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-200/30 p-4">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-400/5 via-transparent to-transparent" />
    <div className="relative flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Timer className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Keyingi raund</p>
          <p className="text-sm font-bold">Har 30 daqiqada</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="bg-background/80 backdrop-blur-sm rounded-xl px-3.5 py-2 min-w-[54px] text-center border border-border/50 shadow-sm">
          <motion.span key={minutes} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-black inline-block tabular-nums">
            {String(minutes).padStart(2, '0')}
          </motion.span>
          <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">d</span>
        </div>
        <motion.span className="text-2xl font-black text-orange-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>:</motion.span>
        <div className="bg-background/80 backdrop-blur-sm rounded-xl px-3.5 py-2 min-w-[54px] text-center border border-border/50 shadow-sm">
          <motion.span key={seconds} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-black inline-block tabular-nums">
            {String(seconds).padStart(2, '0')}
          </motion.span>
          <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">s</span>
        </div>
      </div>
    </div>
  </div>
);
