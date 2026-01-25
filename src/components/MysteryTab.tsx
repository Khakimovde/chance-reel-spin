import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { hapticFeedback } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { useTelegram } from '@/hooks/useTelegram';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, Users, Bell, Coins, 
  CheckCircle, ChevronRight, Loader2, ListTodo, Clock
} from 'lucide-react';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  image: string;
  reward: { type: string; value: number; label: string };
  maxCount: number;
  currentCount: number;
  completed: boolean;
  action: string;
  color: string;
  taskKey: 'watchAd' | 'inviteFriend' | 'joinChannel';
  isTimed: boolean;
}

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const MysteryTab = () => {
  const { 
    addCoins, taskCompletion, completeTask, 
    resetTasksIfNeeded, getTaskResetTime
  } = useGameStore();
  const { user } = useTelegram();
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [channelVerified, setChannelVerified] = useState(false);
  const [checkingChannel, setCheckingChannel] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Preload ad SDK and check task reset
  useEffect(() => {
    loadAdSdk();
    resetTasksIfNeeded();
  }, [resetTasksIfNeeded]);

  // Update countdown timer for timed tasks
  useEffect(() => {
    const updateTimer = () => {
      const resetTime = getTaskResetTime();
      const remaining = resetTime.getTime() - Date.now();
      setTimeRemaining(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [getTaskResetTime]);

  // Build tasks from current completion state
  // Watch ad and invite friends are timed (reset every 6 hours)
  // Join channel is unlimited but requires Telegram verification
  const tasks: DailyTask[] = [
    {
      id: 'watch_ad',
      title: 'Reklama ko\'rish',
      description: `${taskCompletion.watchAd}/10 ta reklama ko'rildi`,
      icon: Play,
      image: '🎬',
      reward: { type: 'coins', value: 50, label: '50 Tanga' },
      maxCount: 10,
      currentCount: taskCompletion.watchAd,
      completed: taskCompletion.watchAd >= 10,
      action: 'Ko\'rish',
      color: '#F59E0B',
      taskKey: 'watchAd',
      isTimed: true,
    },
    {
      id: 'invite_friend',
      title: 'Do\'st taklif qilish',
      description: `${taskCompletion.inviteFriend}/2 ta do'st taklif qilindi`,
      icon: Users,
      image: '👥',
      reward: { type: 'coins', value: 100, label: '100 Tanga' },
      maxCount: 2,
      currentCount: taskCompletion.inviteFriend,
      completed: taskCompletion.inviteFriend >= 2,
      action: 'Taklif qilish',
      color: '#3B82F6',
      taskKey: 'inviteFriend',
      isTimed: true,
    },
    {
      id: 'join_channel',
      title: 'Kanalga qo\'shilish',
      description: taskCompletion.joinChannel ? 'Obuna tasdiqlangan ✓' : 'Rasmiy kanalga obuna bo\'ling',
      icon: Bell,
      image: '📢',
      reward: { type: 'coins', value: 200, label: '200 Tanga' },
      maxCount: 1,
      currentCount: taskCompletion.joinChannel ? 1 : 0,
      completed: taskCompletion.joinChannel,
      action: 'Tekshirish',
      color: '#06B6D4',
      taskKey: 'joinChannel',
      isTimed: false, // Unlimited - but requires verification
    },
  ];

  const handleTaskSelect = (task: DailyTask) => {
    if (task.completed) return;
    hapticFeedback('selection');
    setSelectedTask(task);
    setChannelVerified(false);
  };

  const verifyChannelSubscription = async () => {
    if (!user?.id) return false;
    
    setCheckingChannel(true);
    try {
      // Call edge function to verify Telegram channel subscription
      const { data, error } = await supabase.functions.invoke('verify-channel-subscription', {
        body: { telegramId: user.id }
      });
      
      if (error) {
        console.error('Error verifying channel:', error);
        setCheckingChannel(false);
        return false;
      }
      
      const isSubscribed = data?.subscribed === true;
      setChannelVerified(isSubscribed);
      setCheckingChannel(false);
      return isSubscribed;
    } catch (err) {
      console.error('Error:', err);
      setCheckingChannel(false);
      return false;
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || selectedTask.completed) return;
    
    hapticFeedback('medium');
    setIsLoading(true);

    try {
      if (selectedTask.taskKey === 'watchAd') {
        // Show ad
        const adShown = await showAd();
        if (!adShown) {
          setIsLoading(false);
          return;
        }
        completeTask('watchAd');
        addCoins(selectedTask.reward.value);
      } else if (selectedTask.taskKey === 'inviteFriend') {
        // Open share dialog
        const referralCode = user?.referral_code || 'LOTTERY';
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/LotteryBot?start=${referralCode}`)}&text=${encodeURIComponent('🎰 Lotereya o\'yiniga qo\'shiling va tangalar yutib oling!')}`;
        window.open(shareUrl, '_blank');
        completeTask('inviteFriend');
        addCoins(selectedTask.reward.value);
      } else if (selectedTask.taskKey === 'joinChannel') {
        // First open channel, then verify
        window.open('https://t.me/LotteryChannel', '_blank');
        
        // Wait a moment then verify
        setTimeout(async () => {
          const verified = await verifyChannelSubscription();
          if (verified) {
            completeTask('joinChannel');
            addCoins(selectedTask.reward.value);
            hapticFeedback('success');
          } else {
            hapticFeedback('error');
          }
          setIsLoading(false);
          setSelectedTask(null);
        }, 3000);
        return;
      }
      
      hapticFeedback('success');
    } catch (error) {
      console.error('Task completion error:', error);
    } finally {
      setIsLoading(false);
      setSelectedTask(null);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;

  // Check if timed tasks are all completed
  const timedTasksCompleted = taskCompletion.watchAd >= 10 && taskCompletion.inviteFriend >= 2;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          Vazifalar
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Vazifalarni bajaring va tanga yutib oling
        </p>
      </div>

      {/* Progress Card */}
      <div className="glass-card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Jarayon</span>
          <span className="text-primary font-bold">{completedCount}/{tasks.length}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Task List */}
      <AnimatePresence mode="wait">
        <motion.div
          key="tasks"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-3"
        >
          {tasks.map((task, index) => (
            <motion.button
              key={task.id}
              onClick={() => handleTaskSelect(task)}
              disabled={task.completed || isLoading}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`w-full glass-card p-4 flex items-center gap-4 text-left transition-all ${
                task.completed ? 'opacity-60' : 'hover:shadow-md active:scale-[0.99]'
              }`}
            >
              {/* Task Image/Emoji */}
              <div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${
                  task.completed ? 'bg-success/10' : 'bg-muted'
                }`}
                style={{ backgroundColor: task.completed ? undefined : task.color + '10' }}
              >
                {task.completed ? '✅' : task.image}
              </div>

              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{task.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{task.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                      <Coins className="w-2.5 h-2.5 text-amber-600" />
                    </div>
                    <span className="text-xs text-amber-600 font-semibold">{task.reward.label}</span>
                  </div>
                  {!task.isTimed && !task.completed && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Cheksiz
                    </span>
                  )}
                </div>
                
                {/* Progress bar for multi-count tasks */}
                {task.maxCount > 1 && !task.completed && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(task.currentCount / task.maxCount) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Action / Status */}
              <div className="flex flex-col items-end gap-1">
                {task.completed ? (
                  <span className="px-2 py-1 bg-success/20 text-success text-xs font-semibold rounded-lg flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Bajarildi
                  </span>
                ) : task.isTimed && timedTasksCompleted ? (
                  // Show countdown timer for timed tasks that are completed
                  <div className="flex items-center gap-1 text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{formatTimeRemaining(timeRemaining)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-primary">
                    <span className="text-xs font-semibold">{task.action}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Selected Task Modal */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => !isLoading && setSelectedTask(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-md rounded-t-3xl p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                  style={{ backgroundColor: selectedTask.color + '20' }}
                >
                  {selectedTask.image}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedTask.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-4">
                <Coins className="w-6 h-6 text-amber-500" />
                <span className="text-2xl font-bold">{selectedTask.reward.label}</span>
              </div>

              {selectedTask.taskKey === 'joinChannel' && (
                <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                  <p>📢 Kanalga qo'shilib, tekshirish tugmasini bosing.</p>
                  <p className="text-xs mt-1">Telegram ID orqali obuna tekshiriladi.</p>
                </div>
              )}

              <button
                onClick={handleCompleteTask}
                disabled={isLoading || checkingChannel}
                className="w-full py-4 rounded-2xl gradient-primary text-white font-bold shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading || checkingChannel ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {checkingChannel ? 'Tekshirilmoqda...' : 'Yuklanmoqda...'}
                  </>
                ) : (
                  <>
                    {selectedTask.action}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => setSelectedTask(null)}
                disabled={isLoading}
                className="w-full py-3 text-muted-foreground font-medium"
              >
                Bekor qilish
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
