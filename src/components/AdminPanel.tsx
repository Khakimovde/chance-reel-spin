import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  BarChart3, 
  Wallet, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ArrowLeft,
  Play,
  Eye,
  TrendingUp,
  Clock,
  Banknote,
  Bell,
  Plus,
  Minus,
  Search,
  Coins,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { hapticFeedback } from '@/lib/telegram';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  wallet_address: string | null;
  created_at: string;
  processed_at: string | null;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  user?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    telegram_id: number;
    coins: number;
  };
}

interface RequiredChannel {
  id: string;
  channel_username: string;
  reward_amount: number;
  is_active: boolean;
}

interface Stats {
  totalUsers: number;
  todayUsers: number;
  totalAdsWatched: number;
  todayAdsWatched: number;
  totalWheelSpins: number;
  todayWheelSpins: number;
  totalGamesPlayed: number;
  todayGamesPlayed: number;
  pendingWithdrawals: number;
  totalWithdrawalsAmount: number;
  totalCoinsInSystem: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

// Constants for withdrawal
const MIN_WITHDRAWAL = 5000; // 5000 tanga = 10,000 som
const COIN_TO_SOM_RATE = 2; // 1 tanga = 2 som

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [activeSection, setActiveSection] = useState<'stats' | 'withdrawals' | 'channels' | 'users'>('stats');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  
  // User management
  const [searchTelegramId, setSearchTelegramId] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [coinAmount, setCoinAmount] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdatingCoins, setIsUpdatingCoins] = useState(false);
  
  // Channel management
  const [channels, setChannels] = useState<RequiredChannel[]>([]);
  const [newChannelUsername, setNewChannelUsername] = useState('');
  const [newChannelReward, setNewChannelReward] = useState('200');
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState<RequiredChannel | null>(null);
  const [editChannelReward, setEditChannelReward] = useState('');

  // Auto-refresh interval
  useEffect(() => {
    fetchData();
    fetchChannels();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('required_channels')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setChannels(data);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const addChannel = async () => {
    if (!newChannelUsername.trim()) {
      toast.error('Kanal username kiriting');
      return;
    }

    const username = newChannelUsername.startsWith('@') ? newChannelUsername : `@${newChannelUsername}`;
    const reward = parseInt(newChannelReward) || 200;

    setIsAddingChannel(true);
    try {
      const { error } = await supabase
        .from('required_channels')
        .insert({
          channel_username: username,
          reward_amount: reward,
          is_active: true,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Bu kanal allaqachon mavjud');
        } else {
          throw error;
        }
      } else {
        toast.success('Kanal qo\'shildi');
        setNewChannelUsername('');
        setNewChannelReward('200');
        await fetchChannels();
      }
    } catch (error) {
      console.error('Error adding channel:', error);
      toast.error('Kanal qo\'shishda xatolik');
    } finally {
      setIsAddingChannel(false);
    }
  };

  const updateChannelReward = async (channelId: string, newReward: number) => {
    try {
      const { error } = await supabase
        .from('required_channels')
        .update({ reward_amount: newReward })
        .eq('id', channelId);

      if (error) throw error;

      toast.success('Kanal yangilandi');
      setEditingChannel(null);
      await fetchChannels();
    } catch (error) {
      console.error('Error updating channel:', error);
      toast.error('Kanal yangilashda xatolik');
    }
  };

  const deleteChannel = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('required_channels')
        .delete()
        .eq('id', channelId);

      if (error) throw error;

      toast.success('Kanal o\'chirildi');
      await fetchChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Kanal o\'chirishda xatolik');
    }
  };

  const fetchData = async () => {
    try {
      // Use COUNT to get total users (avoids 1000 row limit)
      const { count: totalUsersCount, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      // Get today's new users count
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayUsersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());
      
      // Get total coins in system (need to fetch all for sum)
      // Use range to fetch in batches if over 1000
      let allCoins = 0;
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: coinsBatch } = await supabase
          .from('users')
          .select('coins')
          .range(offset, offset + batchSize - 1);
        
        if (coinsBatch && coinsBatch.length > 0) {
          allCoins += coinsBatch.reduce((sum, u) => sum + (u.coins || 0), 0);
          offset += batchSize;
          if (coinsBatch.length < batchSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      // Fetch all withdrawals with user info
      const { data: withdrawalsData, error: withdrawalsError } = await supabase 
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (withdrawalsError) throw withdrawalsError;

      // Fetch game history count
      const { count: gamesCount } = await supabase
        .from('game_history')
        .select('*', { count: 'exact', head: true });

      // Fetch ALL daily stats and sum them up
      const { data: allDailyStats } = await supabase
        .from('daily_stats')
        .select('*');
      
      // Calculate total ads from all daily stats
      const totalAdsFromStats = allDailyStats?.reduce((sum, d) => sum + (d.ads_watched || 0), 0) || 0;
      const totalWheelFromStats = allDailyStats?.reduce((sum, d) => sum + (d.wheel_spins || 0), 0) || 0;
      
      // Fetch today's stats
      const today = new Date().toISOString().split('T')[0];
      const todayStats = allDailyStats?.find(d => d.date === today);
      
      const pendingWithdrawals = withdrawalsData?.filter(w => w.status === 'pending').length || 0;
      const totalWithdrawalsAmount = withdrawalsData?.filter(w => w.status === 'paid').reduce((sum, w) => sum + w.amount, 0) || 0;

      setStats({
        totalUsers: totalUsersCount || 0,
        todayUsers: todayUsersCount || 0,
        totalAdsWatched: totalAdsFromStats,
        todayAdsWatched: todayStats?.ads_watched || 0,
        totalWheelSpins: totalWheelFromStats,
        todayWheelSpins: todayStats?.wheel_spins || 0,
        totalGamesPlayed: gamesCount || 0,
        todayGamesPlayed: todayStats?.games_played || 0,
        pendingWithdrawals,
        totalWithdrawalsAmount,
        totalCoinsInSystem: allCoins,
      });

      setWithdrawals(withdrawalsData || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject' | 'pay', reason?: string) => {
    setProcessingId(withdrawalId);
    try {
      const newStatus = action === 'approve' ? 'approved' : action === 'pay' ? 'paid' : 'rejected';
      
      const updateData: any = { 
        status: newStatus,
        processed_at: new Date().toISOString()
      };
      
      // Add rejection reason if provided
      if (action === 'reject' && reason) {
        updateData.rejection_reason = reason;
      }
      
      const { error } = await supabase
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawalId);

      if (error) throw error;

      // If rejected, return coins to user's main balance (coins)
      if (action === 'reject') {
        const withdrawal = withdrawals.find(w => w.id === withdrawalId);
        if (withdrawal) {
          const { data: userData } = await supabase
            .from('users')
            .select('coins')
            .eq('id', withdrawal.user_id)
            .maybeSingle();

          if (userData) {
            await supabase
              .from('users')
              .update({ 
                coins: userData.coins + withdrawal.amount
              })
              .eq('id', withdrawal.user_id);
          }
        }
      }

      hapticFeedback('success');
      toast.success(
        action === 'approve' ? 'So\'rov tasdiqlandi' :
        action === 'pay' ? 'To\'lov amalga oshirildi' :
        'So\'rov rad etildi va tangalar qaytarildi'
      );
      
      setRejectionReason('');
      setShowRejectModal(null);
      await fetchData();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (withdrawalId: string) => {
    setShowRejectModal(withdrawalId);
    setRejectionReason('');
  };

  const searchUserByTelegramId = async () => {
    if (!searchTelegramId.trim()) {
      toast.error('Telegram ID kiriting');
      return;
    }

    setIsSearching(true);
    setFoundUser(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', parseInt(searchTelegramId))
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFoundUser(data);
        hapticFeedback('success');
      } else {
        toast.error('Foydalanuvchi topilmadi');
        hapticFeedback('error');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Qidirishda xatolik');
    } finally {
      setIsSearching(false);
    }
  };

  const updateUserCoins = async (action: 'add' | 'subtract') => {
    if (!foundUser || !coinAmount || isNaN(parseInt(coinAmount))) {
      toast.error('Tanga miqdorini kiriting');
      return;
    }

    const amount = parseInt(coinAmount);
    if (amount <= 0) {
      toast.error('Musbat son kiriting');
      return;
    }

    if (action === 'subtract' && amount > foundUser.coins) {
      toast.error('Foydalanuvchida yetarli tanga yo\'q');
      return;
    }

    setIsUpdatingCoins(true);

    try {
      const newCoins = action === 'add' 
        ? foundUser.coins + amount 
        : foundUser.coins - amount;

      const { error } = await supabase
        .from('users')
        .update({ coins: newCoins })
        .eq('id', foundUser.id);

      if (error) throw error;

      setFoundUser({ ...foundUser, coins: newCoins });
      setCoinAmount('');
      hapticFeedback('success');
      toast.success(
        action === 'add' 
          ? `${amount} tanga qo'shildi` 
          : `${amount} tanga ayirildi`
      );
      
      // Refresh stats
      await fetchData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Yangilashda xatolik');
    } finally {
      setIsUpdatingCoins(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">⏳ Kutilmoqda</span>;
      case 'approved':
        return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">✅ Tasdiqlangan</span>;
      case 'paid':
        return <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium border border-green-200">💰 To'langan</span>;
      case 'rejected':
        return <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium border border-red-200">❌ Rad etilgan</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-glass-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Admin Panel</h1>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="px-4 py-3 border-b border-glass-border overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setActiveSection('stats')}
            className={`py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeSection === 'stats'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Statistika
          </button>
          <button
            onClick={() => setActiveSection('withdrawals')}
            className={`py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeSection === 'withdrawals'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Pul yechish
            {stats && stats.pendingWithdrawals > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {stats.pendingWithdrawals}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('channels')}
            className={`py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeSection === 'channels'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Bell className="w-4 h-4" />
            Kanallar
          </button>
          <button
            onClick={() => setActiveSection('users')}
            className={`py-2 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeSection === 'users'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            Foydalanuvchilar
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        <AnimatePresence mode="wait">
          {/* Stats Section */}
          {activeSection === 'stats' && stats && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Main Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card-elevated p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                    <span className="text-xs text-green-600 font-medium">+{stats.todayUsers} bugun</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Jami foydalanuvchilar</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card-elevated p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <Play className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.totalAdsWatched}</p>
                    <span className="text-xs text-green-600 font-medium">+{stats.todayAdsWatched} bugun</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Jami reklama ko'rilgan</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card-elevated p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.totalWheelSpins}</p>
                    <span className="text-xs text-green-600 font-medium">+{stats.todayWheelSpins} bugun</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Wheel aylantirgan</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 }}
                  className="glass-card-elevated p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.totalGamesPlayed}</p>
                    <span className="text-xs text-green-600 font-medium">+{stats.todayGamesPlayed} bugun</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Jami o'yinlar</p>
                </motion.div>
              </div>

              {/* System Stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card-elevated p-4 space-y-3"
              >
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  Tizim statistikasi
                </h3>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs text-amber-600 mb-1">Tizimdagi jami tangalar</p>
                  <p className="text-xl font-bold text-amber-700">{stats.totalCoinsInSystem.toLocaleString()} tanga</p>
                </div>
              </motion.div>

              {/* Financial Stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass-card-elevated p-4 space-y-3"
              >
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-green-500" />
                  Moliyaviy statistika
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-600 mb-1">Kutilayotgan so'rovlar</p>
                    <p className="text-xl font-bold text-amber-700">{stats.pendingWithdrawals}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl">
                    <p className="text-xs text-green-600 mb-1">Jami to'langan</p>
                    <p className="text-xl font-bold text-green-700">{stats.totalWithdrawalsAmount.toLocaleString()} tanga</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-600 mb-1">Minimal yechish miqdori</p>
                  <p className="text-lg font-bold text-blue-700">{MIN_WITHDRAWAL.toLocaleString()} tanga = {(MIN_WITHDRAWAL * COIN_TO_SOM_RATE).toLocaleString()} so'm</p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Withdrawals Section */}
          {activeSection === 'withdrawals' && (
            <motion.div
              key="withdrawals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Info Card */}
              <div className="glass-card p-3 bg-blue-50/50">
                <p className="text-xs text-blue-700">
                  💡 Minimal yechish: <strong>{MIN_WITHDRAWAL.toLocaleString()} tanga = {(MIN_WITHDRAWAL * COIN_TO_SOM_RATE).toLocaleString()} so'm</strong>
                </p>
              </div>

              {withdrawals.length === 0 ? (
                <div className="glass-card-elevated p-8 text-center">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Hozircha so'rovlar yo'q</p>
                </div>
              ) : (
                withdrawals.map((withdrawal, index) => {
                  // Get card background color based on status
                  const getCardStyle = () => {
                    switch (withdrawal.status) {
                      case 'pending':
                        return 'border-l-4 border-l-amber-400';
                      case 'approved':
                        return 'border-l-4 border-l-blue-400 bg-blue-50/30';
                      case 'paid':
                        return 'border-l-4 border-l-green-400 bg-green-50/30';
                      case 'rejected':
                        return 'border-l-4 border-l-red-400 bg-red-50/30';
                      default:
                        return '';
                    }
                  };

                  return (
                  <motion.div
                    key={withdrawal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`glass-card-elevated p-4 space-y-3 ${getCardStyle()}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {withdrawal.first_name || withdrawal.user?.first_name || 'Ism yo\'q'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{withdrawal.username || withdrawal.user?.username || 'username yo\'q'} • ID: {withdrawal.telegram_id || withdrawal.user?.telegram_id || 'yo\'q'}
                        </p>
                      </div>
                      {getStatusBadge(withdrawal.status)}
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Miqdor:</span>
                      <div className="text-right">
                        <span className="font-bold text-foreground">{withdrawal.amount.toLocaleString()} tanga</span>
                        <span className="text-xs text-muted-foreground block">= {(withdrawal.amount * COIN_TO_SOM_RATE).toLocaleString()} so'm</span>
                      </div>
                    </div>

                    {withdrawal.wallet_address && (
                      <div className="p-2.5 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Hamyon:</p>
                        <p className="text-xs text-foreground break-all">{withdrawal.wallet_address}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(withdrawal.created_at).toLocaleString('uz-UZ')}
                    </div>

                    {/* Pending: Show Approve + Reject buttons */}
                    {withdrawal.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                          disabled={processingId === withdrawal.id}
                          className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {processingId === withdrawal.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Tasdiqlash
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openRejectModal(withdrawal.id)}
                          disabled={processingId === withdrawal.id}
                          className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Rad etish
                        </button>
                      </div>
                    )}

                    {/* Approved: Show Pay button */}
                    {withdrawal.status === 'approved' && (
                      <button
                        onClick={() => handleWithdrawalAction(withdrawal.id, 'pay')}
                        disabled={processingId === withdrawal.id}
                        className="w-full py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {processingId === withdrawal.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Banknote className="w-4 h-4" />
                            To'lash
                          </>
                        )}
                      </button>
                    )}

                    {/* Paid: Show success message */}
                    {withdrawal.status === 'paid' && (
                      <div className="text-center py-2 text-green-600 font-medium text-sm">
                        ✅ To'lov amalga oshirildi
                      </div>
                    )}

                    {/* Rejected: Show reason if available */}
                    {withdrawal.status === 'rejected' && (
                      <div className="text-center py-2 text-red-600 font-medium text-sm">
                        ❌ So'rov rad etildi
                      </div>
                    )}
                  </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Channels Section */}
          {activeSection === 'channels' && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Add New Channel */}
              <div className="glass-card-elevated p-4 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-500" />
                  Yangi kanal qo'shish
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Kanal username</label>
                    <input
                      type="text"
                      value={newChannelUsername}
                      onChange={(e) => setNewChannelUsername(e.target.value)}
                      placeholder="@ChannelUsername"
                      className="w-full p-3 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Obuna uchun tanga mukofoti</label>
                    <input
                      type="number"
                      value={newChannelReward}
                      onChange={(e) => setNewChannelReward(e.target.value)}
                      placeholder="200"
                      className="w-full p-3 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                  <button 
                    onClick={addChannel}
                    disabled={isAddingChannel || !newChannelUsername.trim()}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAddingChannel ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Kanal qo'shish
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Existing Channels List */}
              <div className="glass-card-elevated p-4 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-500" />
                  Mavjud kanallar ({channels.length})
                </h3>
                
                {channels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Hozircha kanallar yo'q</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {channels.map((channel) => (
                      <div key={channel.id} className="p-3 bg-muted/50 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{channel.channel_username}</p>
                            <p className="text-xs text-muted-foreground">Mukofot: {channel.reward_amount} tanga</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingChannel(channel);
                                setEditChannelReward(String(channel.reward_amount));
                              }}
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteChannel(channel.id)}
                              className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Inline Edit Mode */}
                        {editingChannel?.id === channel.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2 border-t border-border space-y-2"
                          >
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Yangi mukofot miqdori</label>
                              <input
                                type="number"
                                value={editChannelReward}
                                onChange={(e) => setEditChannelReward(e.target.value)}
                                className="w-full p-2 rounded-lg border border-border bg-background text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingChannel(null)}
                                className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium"
                              >
                                Bekor
                              </button>
                              <button
                                onClick={() => updateChannelReward(channel.id, parseInt(editChannelReward) || 200)}
                                className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium"
                              >
                                Saqlash
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Users Section */}
          {activeSection === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Search User */}
              <div className="glass-card-elevated p-4 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" />
                  Foydalanuvchi qidirish
                </h3>
                
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={searchTelegramId}
                    onChange={(e) => setSearchTelegramId(e.target.value)}
                    placeholder="Telegram ID kiriting"
                    className="flex-1 p-3 rounded-lg border border-border bg-background text-sm"
                  />
                  <button
                    onClick={searchUserByTelegramId}
                    disabled={isSearching}
                    className="px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Found User */}
              {foundUser && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card-elevated p-4 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {foundUser.first_name} {foundUser.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{foundUser.username || 'username yo\'q'} • ID: {foundUser.telegram_id}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-600 mb-1">Joriy balans</p>
                    <p className="text-2xl font-bold text-amber-700">{foundUser.coins?.toLocaleString() || 0} tanga</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Tanga miqdori</label>
                    <input
                      type="number"
                      value={coinAmount}
                      onChange={(e) => setCoinAmount(e.target.value)}
                      placeholder="Miqdorni kiriting"
                      className="w-full p-3 rounded-lg border border-border bg-background text-sm"
                    />
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateUserCoins('add')}
                        disabled={isUpdatingCoins || !coinAmount}
                        className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isUpdatingCoins ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Qo'shish
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => updateUserCoins('subtract')}
                        disabled={isUpdatingCoins || !coinAmount}
                        className="flex-1 py-3 rounded-lg bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isUpdatingCoins ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Minus className="w-4 h-4" />
                            Ayirish
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-2xl p-5 space-y-4"
            >
              <h3 className="text-lg font-bold text-foreground">So'rovni rad etish</h3>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Rad etish sababi</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Sababni kiriting..."
                  className="w-full p-3 rounded-lg border border-border bg-background text-sm min-h-[100px]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 py-3 rounded-lg bg-muted text-muted-foreground font-medium"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => handleWithdrawalAction(showRejectModal, 'reject', rejectionReason)}
                  disabled={processingId === showRejectModal}
                  className="flex-1 py-3 rounded-lg bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processingId === showRejectModal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Rad etish
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
