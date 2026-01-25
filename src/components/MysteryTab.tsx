import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { hapticFeedback, getTelegramWebApp } from '@/lib/telegram';
import { showAd, loadAdSdk } from '@/lib/adService';
import { 
  Play, Users, Share2, 
  Bell, Star, Coins, Ticket,
  CheckCircle, ChevronRight, Loader2, Clock, ListTodo
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
  taskKey: 'watchAd' | 'inviteFriend' | 'shareStory' | 'joinChannel' | 'rateApp';
}

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Get next reset time display (00:00, 06:00, 12:00, 18:00)
const getNextResetTimeDisplay = (): string => {
  const now = new Date();
  const currentHour = now.getHours();
  const resetHours = [0, 6, 12, 18];
  let nextResetHour = resetHours.find(h => h > currentHour);
  
  if (nextResetHour === undefined) {
    nextResetHour = 0;
  }
  
  return `${nextResetHour.toString().padStart(2, '0')}:00`;
};

export const MysteryTab = () => {
  const { 
    addCoins, addTicket, taskCompletion, completeTask, 
    resetTasksIfNeeded, getTaskResetTime 
  } = useGameStore();
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Preload ad SDK and check task reset
  useEffect(() => {
    loadAdSdk();
    resetTasksIfNeeded();
  }, [resetTasksIfNeeded]);

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const resetTime = getTaskResetTime();
      const remaining = resetTime.getTime() - Date.now();
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [getTaskResetTime]);

  // Build tasks from current completion state
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
    },
    {
      id: 'invite_friend',
      title: 'Do\'st taklif qilish',
      description: `${taskCompletion.inviteFriend}/2 ta do'st taklif qilindi`,
      icon: Users,
      image: '👥',
      reward: { type: 'ticket', value: 1, label: '1 Chipta' },
      maxCount: 2,
      currentCount: taskCompletion.inviteFriend,
      completed: taskCompletion.inviteFriend >= 2,
      action: 'Taklif qilish',
      color: '#3B82F6',
      taskKey: 'inviteFriend',
    },
    {
      id: 'share_story',
      title: 'Story ulashish',
      description: 'Telegramda story ulashing',
      icon: Share2,
      image: '📱',
      reward: { type: 'coins', value: 100, label: '100 Tanga' },
      maxCount: 1,
      currentCount: taskCompletion.shareStory ? 1 : 0,
      completed: taskCompletion.shareStory,
      action: 'Ulashish',
      color: '#8B5CF6',
      taskKey: 'shareStory',
    },
    {
      id: 'join_channel',
      title: 'Kanalga qo\'shilish',
      description: 'Rasmiy kanalga obuna bo\'ling',
      icon: Bell,
      image: '📢',
      reward: { type: 'ticket', value: 2, label: '2 Chipta' },
      maxCount: 1,
      currentCount: taskCompletion.joinChannel ? 1 : 0,
      completed: taskCompletion.joinChannel,
      action: 'Qo\'shilish',
      color: '#06B6D4',
      taskKey: 'joinChannel',
    },
    {
      id: 'rate_app',
      title: 'Baholash',
      description: 'Ilovaga 5 yulduz bering',
      icon: Star,
      image: '⭐',
      reward: { type: 'coins', value: 200, label: '200 Tanga' },
      maxCount: 1,
      currentCount: taskCompletion.rateApp ? 1 : 0,
      completed: taskCompletion.rateApp,
      action: 'Baholash',
      color: '#F59E0B',
      taskKey: 'rateApp',
    },
  ];

  const handleTaskSelect = (task: DailyTask) => {
    if (task.completed) return;
    hapticFeedback('selection');
    setSelectedTask(task);
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
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/LotteryBot')}&text=${encodeURIComponent('🎰 Lotereya o\'yiniga qo\'shiling!')}`;
        window.open(shareUrl, '_blank');
        completeTask('inviteFriend');
        addTicket();
      } else if (selectedTask.taskKey === 'shareStory') {
        // Story sharing
        completeTask('shareStory');
        addCoins(selectedTask.reward.value);
      } else if (selectedTask.taskKey === 'joinChannel') {
        // Open channel
        window.open('https://t.me/LotteryChannel', '_blank');
        completeTask('joinChannel');
        for (let i = 0; i < selectedTask.reward.value; i++) addTicket();
      } else if (selectedTask.taskKey === 'rateApp') {
        completeTask('rateApp');
        addCoins(selectedTask.reward.value);
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

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          Kunlik Vazifalar
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Keyingi yangilanish: {getNextResetTimeDisplay()} da
        </p>
      </div>

      {/* Timer Card */}
      <div className="glass-card p-3 flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Yangilanishga qoldi:</span>
        <span className="text-sm font-bold text-primary">{formatTimeRemaining(timeRemaining)}</span>
      </div>

      {/* Progress Card */}
      <div className="glass-card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Bugungi jarayon</span>
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
                  {task.completed && (
                    <CheckCircle className="w-4 h-4 text-success" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{task.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                      {task.reward.type === 'ticket' ? (
                        <Ticket className="w-2.5 h-2.5 text-blue-600" />
                      ) : (
                        <Coins className="w-2.5 h-2.5 text-amber-600" />
                      )}
                    </div>
                    <span className="text-xs text-amber-600 font-semibold">{task.reward.label}</span>
                  </div>
                </div>
                
                {/* Progress bar for multi-count tasks */}
                {task.maxCount > 1 && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(task.currentCount / task.maxCount) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Action */}
              {!task.completed && (
                <div className="flex items-center gap-1 text-primary">
                  <span className="text-xs font-semibold">{task.action}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
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
                {selectedTask.reward.type === 'ticket' ? (
                  <Ticket className="w-6 h-6 text-blue-500" />
                ) : (
                  <Coins className="w-6 h-6 text-amber-500" />
                )}
                <span className="text-2xl font-bold">{selectedTask.reward.label}</span>
              </div>

              <button
                onClick={handleCompleteTask}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl gradient-primary text-white font-bold shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Yuklanmoqda...
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