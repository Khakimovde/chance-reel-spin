import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrustBadge } from './TrustBadge';
import { CheckCircle, Trophy, Coins, Clock, XCircle, Calendar, Target } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { formatDrawDate, formatDrawTime, generateDrawNumbers, getCurrentDrawSlot } from '@/lib/drawService';

const HISTORY_HOURS = 6; // Show last 6 hours
const DRAW_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface DrawSlotDisplay {
  slotId: string;
  slotTime: Date;
  drawnNumbers: number[];
  userParticipation?: {
    selectedNumbers: number[];
    matches: number;
    reward: number;
  };
}

export const HistoryTab = () => {
  const { drawHistory, persistentStats } = useGameStore();
  const [allSlots, setAllSlots] = useState<DrawSlotDisplay[]>([]);

  useEffect(() => {
    // Generate all draw slots for the last 6 hours
    const now = Date.now();
    const currentSlot = getCurrentDrawSlot();
    const slotsCount = Math.floor((HISTORY_HOURS * 60 * 60 * 1000) / DRAW_INTERVAL);
    
    // Create a map of user participations for quick lookup
    const participationMap = new Map<string, typeof drawHistory[0]>();
    drawHistory.forEach(draw => {
      participationMap.set(draw.id, draw);
    });
    
    const slots: DrawSlotDisplay[] = [];
    
    for (let i = 0; i < slotsCount; i++) {
      const slotTime = new Date(currentSlot.getTime() - (i * DRAW_INTERVAL));
      const slotId = `draw_${slotTime.getTime()}`;
      const drawnNumbers = generateDrawNumbers(slotTime, 7, 42);
      
      // Check if user participated in this slot
      const userDraw = participationMap.get(slotId);
      
      slots.push({
        slotId,
        slotTime,
        drawnNumbers,
        userParticipation: userDraw?.userParticipation ? {
          selectedNumbers: userDraw.userParticipation.selectedNumbers,
          matches: userDraw.userParticipation.matches,
          reward: userDraw.userParticipation.reward,
        } : undefined,
      });
    }
    
    setAllSlots(slots);
  }, [drawHistory]);

  // Group draws by date
  const groupedDraws = allSlots.reduce((acc, slot) => {
    const dateKey = formatDrawDate(slot.slotTime);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, DrawSlotDisplay[]>);

  // Use persistent stats that never reset
  const { totalParticipated, totalWon, totalEarned } = persistentStats;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            O'yin Tarixi
          </h1>
          <p className="text-sm text-muted-foreground">Oxirgi 6 soat</p>
        </div>
        <TrustBadge variant="fair" />
      </div>

      {/* Stats Summary - Persistent */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-primary">{totalParticipated}</p>
          <p className="text-[10px] text-muted-foreground">Qatnashgan</p>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Trophy className="w-4 h-4 text-success" />
          </div>
          <p className="text-xl font-bold text-success">{totalWon}</p>
          <p className="text-[10px] text-muted-foreground">Yutgan</p>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-green-500">${totalEarned}</p>
          <p className="text-[10px] text-muted-foreground">Dollar</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-muted/50 rounded-lg p-2 text-center flex items-center justify-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Har 15 daqiqada yangi o'yin</p>
      </div>

      {/* History List by Date */}
      {Object.keys(groupedDraws).length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Hozircha tarix yo'q</p>
          <p className="text-xs text-muted-foreground mt-1">O'yinda qatnashing!</p>
        </div>
      ) : (
        Object.entries(groupedDraws).map(([date, slots]) => (
          <div key={date} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              {date}
            </h3>
            <div className="space-y-2">
              {slots.map((slot, index) => (
                <motion.div
                  key={slot.slotId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="glass-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-lg font-bold text-foreground">
                        {formatDrawTime(slot.slotTime)}
                      </span>
                    </div>
                    {slot.userParticipation ? (
                      slot.userParticipation.matches >= 3 ? (
                        <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Yutdingiz!
                        </span>
                      ) : (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          Qatnashdingiz
                        </span>
                      )
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        Qatnashmadingiz
                      </span>
                    )}
                  </div>

                  {/* Drawn Numbers - All 7 */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Tushgan raqamlar (7 ta):</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {slot.drawnNumbers.map((num) => {
                        const isMatch = slot.userParticipation?.selectedNumbers.includes(num);
                        return (
                          <span 
                            key={num} 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isMatch 
                                ? 'bg-success text-white shadow-md' 
                                : 'lottery-ball'
                            }`}
                          >
                            {num}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* User Participation Details */}
                  {slot.userParticipation && (
                    <div className="border-t border-border pt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">Sizning tanlovingiz (7 ta):</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {slot.userParticipation.selectedNumbers.map((num) => {
                          const isMatch = slot.drawnNumbers.includes(num);
                          return (
                            <span 
                              key={num} 
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                isMatch 
                                  ? 'bg-success text-white' 
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {num}
                            </span>
                          );
                        })}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          {slot.userParticipation.matches >= 3 ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            <span className="font-bold">{slot.userParticipation.matches}</span>/7 to'g'ri
                          </span>
                        </div>
                        {slot.userParticipation.reward > 0 && (
                          <div className="flex items-center gap-1 text-success font-bold">
                            <Coins className="w-4 h-4" />
                            <span>+{slot.userParticipation.reward}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Fairness Note */}
      <div className="glass-card p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-success" />
          <span className="font-medium text-sm">Adolatli O'yin</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Barcha natijalar kriptografik xavfsiz tasodifiy son generatori bilan yaratiladi.
        </p>
      </div>
    </div>
  );
};