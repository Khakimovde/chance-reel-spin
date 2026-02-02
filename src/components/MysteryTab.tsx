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
import { toast } from 'sonner';

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

interface RequiredChannel {
  id: string;
  channel_username: string;
  reward_amount: number;
  is_active: boolean;
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
  const { user, refreshUserData } = useTelegram();
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingChannel, setCheckingChannel] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [requiredChannels, setRequiredChannels] = useState<RequiredChannel[]>([]);
  const [selectedChannelTask, setSelectedChannelTask] = useState<RequiredChannel | null>(null);
  const [channelSubscriptions, setChannelSubscriptions] = useState<Record<string, boolean>>({});

  // Helper function to update coins in backend
  const updateCoinsInBackend = async (amount: number, statsType?: string) => {
    if (!user?.id) return false;
    try {
      const { data, error } = await supabase.functions.invoke('update-coins', {
        body: { 
          telegramId: user.id, 
          amount,
          source: 'task',
          updateStats: statsType
        }
      });
      if (error) {
        console.error('Error updating coins:', error);
        return false;
      }
      console.log('Coins updated in backend:', data);
      // CRITICAL: Refresh immediately to sync backend state to UI
      await refreshUserData();
      return true;
    } catch (err) {
      console.error('Error:', err);
      return false;
    }
  };

  // Fetch required channels and check already claimed rewards
  const fetchRequiredChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('required_channels')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setRequiredChannels(data);
        
        // Check which channels user has already claimed rewards for
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', user.id)
            .maybeSingle();
          
          if (userData) {
            // Fetch already claimed channel rewards
            const { data: claimedRewards } = await supabase
              .from('user_channel_rewards')
              .select('channel_id')
              .eq('user_id', userData.id);
            
            if (claimedRewards) {
              const claimedMap: Record<string, boolean> = {};
              claimedRewards.forEach(r => {
                claimedMap[r.channel_id] = true;
              });
              setChannelSubscriptions(claimedMap);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  // Preload ad SDK and check task reset
  useEffect(() => {
    loadAdSdk();
    resetTasksIfNeeded();
  }, [resetTasksIfNeeded]);

  // Fetch channels and claimed rewards when user changes (including refresh)
  useEffect(() => {
    if (user?.id) {
      fetchRequiredChannels();
    }
  }, [user?.id]);

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
  // CHANGED: Watch 10 ads = 200 coins total (only after all 10 completed)
  // CHANGED: Invite 2 friends = 200 coins total (only after both invited)
  const tasks: DailyTask[] = [
    {
      id: 'watch_ad',
      title: 'Reklama ko\'rish',
      description: taskCompletion.watchAd >= 10 
        ? '10/10 ta reklama ko\'rildi ✓' 
        : `${taskCompletion.watchAd}/10 ta reklama ko'ring`,
      icon: Play,
      image: '🎬',
      reward: { type: 'coins', value: 300, label: '300 Tanga' },
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
      description: taskCompletion.inviteFriend >= 2 
        ? '2/2 ta do\'st taklif qilindi ✓' 
        : `${taskCompletion.inviteFriend}/2 ta do'st taklif qiling`,
      icon: Users,
      image: '👥',
      reward: { type: 'coins', value: 160, label: '160 Tanga' },
      maxCount: 2,
      currentCount: taskCompletion.inviteFriend,
      completed: taskCompletion.inviteFriend >= 2,
      action: 'Taklif qilish',
      color: '#3B82F6',
      taskKey: 'inviteFriend',
      isTimed: true,
    },
  ];

  const verifyChannelSubscription = async (channelUsername: string): Promise<{ subscribed: boolean; error?: string }> => {
    if (!user?.id) return { subscribed: false, error: 'Foydalanuvchi topilmadi' };
    
    setCheckingChannel(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-channel-subscription', {
        body: { 
          telegramId: user.id,
          channelUsername: channelUsername
        }
      });
      
      if (error) {
        console.error('Error verifying channel:', error);
        setCheckingChannel(false);
        return { subscribed: false, error: 'Tekshirishda xatolik' };
      }
      
      setCheckingChannel(false);
      
      if (data?.subscribed === true) {
        return { subscribed: true };
      } else {
        // Return specific error message from backend
        return { 
          subscribed: false, 
          error: data?.error || 'Kanalga obuna topilmadi' 
        };
      }
    } catch (err) {
      console.error('Error:', err);
      setCheckingChannel(false);
      return { subscribed: false, error: 'Xatolik yuz berdi' };
    }
  };

  const handleTaskSelect = (task: DailyTask) => {
    if (task.completed) return;
    hapticFeedback('selection');
    setSelectedTask(task);
    setSelectedChannelTask(null);
  };

  const handleChannelTaskSelect = (channel: RequiredChannel) => {
    if (channelSubscriptions[channel.id]) return;
    hapticFeedback('selection');
    setSelectedChannelTask(channel);
    setSelectedTask(null);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || selectedTask.completed) return;
    
    hapticFeedback('medium');
    setIsLoading(true);

    try {
      if (selectedTask.taskKey === 'watchAd') {
        // Show ad - no coins per view, only after completing all 10
        const adShown = await showAd();
        if (!adShown) {
          setIsLoading(false);
          return;
        }
        
        const newCount = taskCompletion.watchAd + 1;
        completeTask('watchAd');
        
        // Update stats for ad view
        await supabase.functions.invoke('update-coins', {
          body: { 
            telegramId: user?.id, 
            amount: 0,
            source: 'task',
            updateStats: 'ads'
          }
        });
        
        // Only give reward when all 10 are completed
        if (newCount >= 10) {
          const success = await updateCoinsInBackend(300);
          if (success) {
            // No need to call addCoins - refreshUserData already synced the state
            toast.success('🎉 10 ta reklama ko\'rildi! +300 tanga qo\'shildi!');
          }
        } else {
          toast.success(`Reklama ko'rildi! ${newCount}/10`);
        }
      } else if (selectedTask.taskKey === 'inviteFriend') {
        // Open share dialog - count is tracked by referral system
        const referralLink = `https://t.me/Luckygame_robot?start=ref_${user?.id || ''}`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎰 Lotereya o\'yiniga qo\'shiling va tangalar yutib oling!')}`;
        window.open(shareUrl, '_blank');
        
        // Note: Actual counting is done by bot when friend joins
        // We show instruction to user
        toast.info('Do\'stingiz qo\'shilganda hisoblanadi');
      }
      
      hapticFeedback('success');
    } catch (error) {
      console.error('Task completion error:', error);
    } finally {
      setIsLoading(false);
      setSelectedTask(null);
    }
  };

  const handleChannelSubscribe = async () => {
    if (!selectedChannelTask || !user?.id) return;
    
    hapticFeedback('medium');
    
    // Open channel first
    const channelUrl = selectedChannelTask.channel_username.startsWith('@') 
      ? `https://t.me/${selectedChannelTask.channel_username.slice(1)}`
      : `https://t.me/${selectedChannelTask.channel_username}`;
    window.open(channelUrl, '_blank');
    
    // Show verify button after opening
    toast.info('Kanalga obuna bo\'lib, tekshirish tugmasini bosing');
  };

  const handleVerifyChannelSubscription = async () => {
    if (!selectedChannelTask || !user?.id) return;
    
    setIsLoading(true);
    
    // First check if already claimed
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', user.id)
      .maybeSingle();
    
    if (userData) {
      const { data: existingClaim } = await supabase
        .from('user_channel_rewards')
        .select('id')
        .eq('user_id', userData.id)
        .eq('channel_id', selectedChannelTask.id)
        .maybeSingle();
      
      if (existingClaim) {
        toast.error('Siz bu kanal uchun mukofotni allaqachon olgansiz!');
        setChannelSubscriptions(prev => ({ ...prev, [selectedChannelTask.id]: true }));
        setIsLoading(false);
        setSelectedChannelTask(null);
        hapticFeedback('error');
        return;
      }
    }
    
    const result = await verifyChannelSubscription(selectedChannelTask.channel_username);
    
    if (result.subscribed && userData) {
      // Record the claim first
      const { error: claimError } = await supabase
        .from('user_channel_rewards')
        .insert({
          user_id: userData.id,
          channel_id: selectedChannelTask.id
        });
      
      if (claimError) {
        if (claimError.code === '23505') { // Duplicate key
          toast.error('Siz bu kanal uchun mukofotni allaqachon olgansiz!');
          setChannelSubscriptions(prev => ({ ...prev, [selectedChannelTask.id]: true }));
        } else {
          toast.error('Xatolik yuz berdi');
        }
        setIsLoading(false);
        setSelectedChannelTask(null);
        return;
      }
      
      const success = await updateCoinsInBackend(selectedChannelTask.reward_amount);
      if (success) {
        // No need to call addCoins - refreshUserData already synced the state
        setChannelSubscriptions(prev => ({ ...prev, [selectedChannelTask.id]: true }));
        toast.success(`+${selectedChannelTask.reward_amount} tanga qo'shildi!`);
        hapticFeedback('success');
      }
    } else {
      hapticFeedback('error');
      toast.error(result.error || 'Kanalga obuna topilmadi. Avval kanalga obuna bo\'ling!');
    }
    
    setIsLoading(false);
    setSelectedChannelTask(null);
  };

  const completedCount = tasks.filter(t => t.completed).length + Object.keys(channelSubscriptions).length;
  const totalTasks = tasks.length + requiredChannels.length;

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
          <span className="text-primary font-bold">{completedCount}/{totalTasks}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full gradient-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / totalTasks) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Timed Tasks */}
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 bg-success/20 text-success text-xs font-semibold rounded-lg flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Bajarildi
                    </span>
                    {/* Show countdown for completed timed tasks */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{formatTimeRemaining(timeRemaining)}</span>
                    </div>
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

          {/* Dynamic Channel Tasks from Database */}
          {requiredChannels.map((channel, index) => {
            const isSubscribed = channelSubscriptions[channel.id];
            return (
              <motion.button
                key={channel.id}
                onClick={() => handleChannelTaskSelect(channel)}
                disabled={isSubscribed || isLoading}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (tasks.length + index) * 0.05 }}
                className={`w-full glass-card p-4 flex items-center gap-4 text-left transition-all ${
                  isSubscribed ? 'opacity-60' : 'hover:shadow-md active:scale-[0.99]'
                }`}
              >
                <div 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${
                    isSubscribed ? 'bg-success/10' : 'bg-cyan-500/10'
                  }`}
                >
                  {isSubscribed ? '✅' : '📢'}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground">Kanalga obuna</span>
                  <p className="text-xs text-muted-foreground">
                    {isSubscribed ? 'Obuna tasdiqlangan ✓' : channel.channel_username}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                        <Coins className="w-2.5 h-2.5 text-amber-600" />
                      </div>
                      <span className="text-xs text-amber-600 font-semibold">{channel.reward_amount} Tanga</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Cheksiz
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {isSubscribed ? (
                    <span className="px-2 py-1 bg-success/20 text-success text-xs font-semibold rounded-lg flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Bajarildi
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 text-primary">
                      <span className="text-xs font-semibold">Obuna</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
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

              {selectedTask.taskKey === 'watchAd' && (
                <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                  <p>🎬 10 ta reklamani ko'ring va 300 tanga oling!</p>
                  <p className="text-xs mt-1">Hozirgi: {taskCompletion.watchAd}/10</p>
                </div>
              )}

              {selectedTask.taskKey === 'inviteFriend' && (
                <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                  <p>👥 2 ta do'st taklif qiling va 160 tanga oling!</p>
                  <p className="text-xs mt-1">Do'st qo'shilganda bot orqali hisoblanadi</p>
                </div>
              )}

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

      {/* Channel Subscription Modal */}
      <AnimatePresence>
        {selectedChannelTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => !isLoading && !checkingChannel && setSelectedChannelTask(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-md rounded-t-3xl p-6 space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl bg-cyan-500/20">
                  📢
                </div>
                <div>
                  <h3 className="text-lg font-bold">Kanalga qo'shilish</h3>
                  <p className="text-sm text-muted-foreground">{selectedChannelTask.channel_username}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-4">
                <Coins className="w-6 h-6 text-amber-500" />
                <span className="text-2xl font-bold">{selectedChannelTask.reward_amount} Tanga</span>
              </div>

              <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                <p>📢 Kanalga obuna bo'lib, tekshirish tugmasini bosing.</p>
                <p className="text-xs mt-1">Telegram ID orqali obuna tekshiriladi.</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleChannelSubscribe}
                  disabled={isLoading || checkingChannel}
                  className="w-full py-4 rounded-2xl bg-[#0088cc] text-white font-bold shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  <Bell className="w-5 h-5" />
                  Kanalga o'tish
                </button>

                <button
                  onClick={handleVerifyChannelSubscription}
                  disabled={isLoading || checkingChannel}
                  className="w-full py-4 rounded-2xl gradient-primary text-white font-bold shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {checkingChannel ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Tekshirilmoqda...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Tekshirish
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setSelectedChannelTask(null)}
                disabled={isLoading || checkingChannel}
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
