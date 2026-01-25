// Draw service for generating lottery results every 15 minutes
// Draws happen at :00, :15, :30, :45 of each hour

export interface DrawResult {
  id: string;
  time: string;
  drawnNumbers: number[];
  expired?: boolean;
  userParticipation?: {
    drawTime: string;
    selectedNumbers: number[];
    drawnNumbers: number[];
    matches: number;
    reward: number;
  };
}

const DRAW_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Get the current draw slot (synchronized for all users)
// Returns the start of the current 15-minute slot
export const getCurrentDrawSlot = (): Date => {
  const now = Date.now();
  const slot = Math.floor(now / DRAW_INTERVAL) * DRAW_INTERVAL;
  return new Date(slot);
};

// Get next draw time (end of current slot = start of next slot)
export const getNextDrawTime = (): Date => {
  const current = getCurrentDrawSlot();
  return new Date(current.getTime() + DRAW_INTERVAL);
};

// Generate consistent numbers based on time slot (pseudo-random but reproducible)
export const generateDrawNumbers = (drawTime: Date, count: number = 7, max: number = 42): number[] => {
  const seed = Math.floor(drawTime.getTime() / 1000);
  const numbers: number[] = [];
  
  let current = seed;
  while (numbers.length < count) {
    current = (current * 1103515245 + 12345) & 0x7fffffff;
    const num = (current % max) + 1;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  
  return numbers.sort((a, b) => a - b);
};

// Format time for display
export const formatDrawTime = (date: Date): string => {
  return date.toLocaleTimeString('uz-UZ', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

// Format date for display
export const formatDrawDate = (date: Date): string => {
  return date.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Get draw result for a specific slot
export const getDrawResultForSlot = (slotId: string): DrawResult => {
  const timestamp = parseInt(slotId.replace('draw_', ''));
  const drawTime = new Date(timestamp);
  const drawnNumbers = generateDrawNumbers(drawTime);
  
  return {
    id: slotId,
    time: formatDrawTime(drawTime),
    drawnNumbers,
  };
};

// Get past draw results (last 6 hours = 24 draws at 15-min intervals)
export const getPastDrawResults = (count: number = 24): DrawResult[] => {
  const results: DrawResult[] = [];
  const currentSlot = getCurrentDrawSlot();
  
  for (let i = 0; i < count; i++) {
    const drawTime = new Date(currentSlot.getTime() - (i * DRAW_INTERVAL));
    const drawnNumbers = generateDrawNumbers(drawTime);
    
    results.push({
      id: `draw_${drawTime.getTime()}`,
      time: formatDrawTime(drawTime),
      drawnNumbers,
    });
  }
  
  return results;
};

// Calculate matches between selected and drawn numbers
export const calculateMatches = (selected: number[], drawn: number[]): number => {
  return selected.filter(num => drawn.includes(num)).length;
};

// Calculate reward based on matches
// 0 match = 10, 1 = 20, 2 = 30, 3 = 40, 4 = 50, 5 = 60, 6 = 70, 7 = 1000
export const getRewardForMatches = (matches: number): number => {
  if (matches === 7) return 1000;
  const rewards: Record<number, number> = {
    0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 70,
  };
  return rewards[matches] || 10;
};

// Referral reward constant
export const REFERRAL_REWARD = 30;

// ========== Fixed-time Reset Logic ==========

// Get the next reset time for tasks/wheel (00:00, 06:00, 12:00, 18:00 local time)
export const getNextFixedResetTime = (): Date => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Find the next reset hour
  const resetHours = [0, 6, 12, 18];
  let nextResetHour = resetHours.find(h => h > currentHour);
  
  const nextReset = new Date(now);
  nextReset.setMinutes(0, 0, 0);
  
  if (nextResetHour !== undefined) {
    nextReset.setHours(nextResetHour);
  } else {
    // Next reset is at 00:00 tomorrow
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0);
  }
  
  return nextReset;
};

// Get the previous reset time (for checking if we should reset)
export const getPreviousFixedResetTime = (): Date => {
  const now = new Date();
  const currentHour = now.getHours();
  
  const resetHours = [0, 6, 12, 18];
  
  // Find the most recent reset hour that has passed
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

// Check if reset is needed based on last reset time
export const shouldResetAtFixedTime = (lastReset: Date | null): boolean => {
  if (!lastReset) return true;
  
  const prevResetTime = getPreviousFixedResetTime();
  const lastResetTime = new Date(lastReset).getTime();
  
  // If the previous fixed reset time is after the last reset, we need to reset
  return prevResetTime.getTime() > lastResetTime;
};

// Get time until next fixed reset
export const getTimeUntilNextReset = (): number => {
  return getNextFixedResetTime().getTime() - Date.now();
};