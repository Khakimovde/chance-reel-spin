import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getTelegramUser } from '@/lib/telegram';

interface UserParticipation {
  drawTime: string;
  selectedNumbers: number[];
  drawnNumbers: number[];
  matches: number;
  reward: number;
}

interface DrawResult {
  id: string;
  time: string;
  drawnNumbers: number[];
  userParticipation?: UserParticipation;
}

interface TaskCompletion {
  watchAd: number;
  inviteFriend: number;
  shareStory: boolean;
  joinChannel: boolean;
  rateApp: boolean;
}

interface PersistentStats {
  totalParticipated: number;
  totalWon: number;
  totalEarned: number;
}

interface PendingParticipation {
  selectedNumbers: number[];
  drawSlot: string;
  drawTime: Date;
}

interface GameState {
  coins: number;
  tickets: number;
  referralCount: number;
  totalWinnings: number;
  selectedNumbers: number[];
  lastWheelSpin: Date | null;
  lastTaskReset: Date | null;
  taskCompletion: TaskCompletion;
  drawHistory: DrawResult[];
  persistentStats: PersistentStats;
  pendingParticipation: PendingParticipation | null;
  
  // Actions
  addCoins: (amount: number) => void;
  addTicket: () => void;
  useTicket: () => boolean;
  addReferral: () => void;
  addWinnings: (amount: number) => void;
  selectNumber: (num: number) => void;
  clearSelection: () => void;
  recordWheelSpin: () => void;
  addDrawResult: (result: DrawResult) => void;
  completeTask: (taskType: keyof TaskCompletion) => void;
  resetTasksIfNeeded: () => boolean;
  getTaskResetTime: () => Date;
  getWheelResetTime: () => Date;
  canSpinWheel: () => boolean;
  updatePersistentStats: (participated: boolean, won: boolean, earned: number) => void;
  setPendingParticipation: (participation: PendingParticipation | null) => void;
  confirmParticipation: () => boolean;
  syncWithBackend: (coins: number, tickets: number, referralCount: number, totalWinnings: number) => void;
}

const DRAW_INTERVAL = 15 * 60 * 1000; // 15 minutes
const MAX_NUMBERS = 7;

// Get the next draw slot (synchronized for all users)
export const getNextDrawSlot = (): Date => {
  const now = Date.now();
  const currentSlot = Math.floor(now / DRAW_INTERVAL) * DRAW_INTERVAL;
  return new Date(currentSlot + DRAW_INTERVAL);
};

export const getCurrentDrawSlot = (): string => {
  const now = Date.now();
  const currentSlot = Math.floor(now / DRAW_INTERVAL) * DRAW_INTERVAL;
  return `draw_${currentSlot}`;
};

export const getTimeUntilNextDraw = (): number => {
  const now = Date.now();
  const nextSlot = getNextDrawSlot().getTime();
  return Math.max(0, nextSlot - now);
};

// Fixed-time reset logic (00:00, 06:00, 12:00, 18:00 local time)
const getNextFixedResetTime = (): Date => {
  const now = new Date();
  const currentHour = now.getHours();
  
  const resetHours = [0, 6, 12, 18];
  let nextResetHour = resetHours.find(h => h > currentHour);
  
  const nextReset = new Date(now);
  nextReset.setMinutes(0, 0, 0);
  
  if (nextResetHour !== undefined) {
    nextReset.setHours(nextResetHour);
  } else {
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0);
  }
  
  return nextReset;
};

const getPreviousFixedResetTime = (): Date => {
  const now = new Date();
  const currentHour = now.getHours();
  
  const resetHours = [0, 6, 12, 18];
  
  let prevResetHour = 0;
  for (const h of resetHours) {
    if (h <= currentHour) {
      prevResetHour = h;
    }
  }
  
  const prevReset = new Date(now);
  prevReset.setHours(prevResetHour, 0, 0, 0);
  
  return prevReset;
};

const shouldResetAtFixedTime = (lastReset: Date | null): boolean => {
  if (!lastReset) return true;
  
  const prevResetTime = getPreviousFixedResetTime();
  const lastResetTime = new Date(lastReset).getTime();
  
  return prevResetTime.getTime() > lastResetTime;
};

// Generate storage key based on Telegram user ID for per-user isolation
const getStorageKey = (): string => {
  const user = getTelegramUser();
  const telegramId = user?.id || 'anonymous';
  return `lottery-game-${telegramId}`;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      coins: 0,
      tickets: 0,
      referralCount: 0,
      totalWinnings: 0,
      selectedNumbers: [],
      lastWheelSpin: null,
      lastTaskReset: null,
      taskCompletion: {
        watchAd: 0,
        inviteFriend: 0,
        shareStory: false,
        joinChannel: false,
        rateApp: false,
      },
      drawHistory: [],
      persistentStats: {
        totalParticipated: 0,
        totalWon: 0,
        totalEarned: 0,
      },
      pendingParticipation: null,

      addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
      addTicket: () => set((state) => ({ tickets: state.tickets + 1 })),
      useTicket: () => {
        const { tickets } = get();
        if (tickets > 0) {
          set({ tickets: tickets - 1 });
          return true;
        }
        return false;
      },
      addReferral: () => set((state) => ({ referralCount: state.referralCount + 1 })),
      addWinnings: (amount) => set((state) => ({ 
        totalWinnings: state.totalWinnings + amount,
        coins: state.coins + amount 
      })),
      selectNumber: (num) => set((state) => {
        if (state.selectedNumbers.includes(num)) {
          return { selectedNumbers: state.selectedNumbers.filter((n) => n !== num) };
        }
        if (state.selectedNumbers.length < MAX_NUMBERS) {
          return { selectedNumbers: [...state.selectedNumbers, num].sort((a, b) => a - b) };
        }
        return state;
      }),
      clearSelection: () => set({ selectedNumbers: [], pendingParticipation: null }),
      recordWheelSpin: () => set({ lastWheelSpin: new Date() }),
      addDrawResult: (result) => set((state) => ({ 
        drawHistory: [result, ...state.drawHistory].slice(0, 100) 
      })),
      completeTask: (taskType) => set((state) => {
        const newCompletion = { ...state.taskCompletion };
        if (taskType === 'watchAd') {
          newCompletion.watchAd = Math.min(newCompletion.watchAd + 1, 10);
        } else if (taskType === 'inviteFriend') {
          newCompletion.inviteFriend = Math.min(newCompletion.inviteFriend + 1, 2);
        } else {
          newCompletion[taskType] = true;
        }
        return { taskCompletion: newCompletion };
      }),
      resetTasksIfNeeded: () => {
        const { lastTaskReset } = get();
        const shouldReset = shouldResetAtFixedTime(lastTaskReset);
        
        if (shouldReset) {
          set({
            lastTaskReset: new Date(),
            taskCompletion: {
              watchAd: 0,
              inviteFriend: 0,
              shareStory: false,
              joinChannel: false,
              rateApp: false,
            }
          });
          return true;
        }
        return false;
      },
      getTaskResetTime: () => {
        return getNextFixedResetTime();
      },
      getWheelResetTime: () => {
        return getNextFixedResetTime();
      },
      canSpinWheel: () => {
        const { lastWheelSpin } = get();
        return shouldResetAtFixedTime(lastWheelSpin);
      },
      updatePersistentStats: (participated, won, earned) => set((state) => ({
        persistentStats: {
          totalParticipated: state.persistentStats.totalParticipated + (participated ? 1 : 0),
          totalWon: state.persistentStats.totalWon + (won ? 1 : 0),
          totalEarned: state.persistentStats.totalEarned + earned,
        }
      })),
      setPendingParticipation: (participation) => set({ pendingParticipation: participation }),
      confirmParticipation: () => {
        const { selectedNumbers, useTicket } = get();
        
        if (selectedNumbers.length !== MAX_NUMBERS) {
          return false;
        }
        
        if (!useTicket()) {
          return false;
        }
        
        const drawSlot = getCurrentDrawSlot();
        const nextDraw = getNextDrawSlot();
        set({ 
          pendingParticipation: {
            selectedNumbers: [...selectedNumbers],
            drawSlot,
            drawTime: nextDraw
          }
        });
        
        return true;
      },
      syncWithBackend: (coins, tickets, referralCount, totalWinnings) => set({
        coins,
        tickets,
        referralCount,
        totalWinnings,
      }),
    }),
    {
      name: getStorageKey(),
      storage: createJSONStorage(() => localStorage),
    }
  )
);