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
  Banknote
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
  user?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    telegram_id: number;
  };
}

interface Stats {
  totalUsers: number;
  totalAdsWatched: number;
  dailyAdsWatched: number;
  totalWheelSpins: number;
  totalGamesPlayed: number;
  pendingWithdrawals: number;
  totalWithdrawalsAmount: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const [activeSection, setActiveSection] = useState<'stats' | 'withdrawals'>('stats');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all users for stats
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) throw usersError;

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

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const totalAdsWatched = users?.reduce((sum, u) => sum + (u.task_watch_ad || 0), 0) || 0;
      
      // Get users who have user data for withdrawals
      const usersMap = new Map(users?.map(u => [u.id, u]) || []);
      
      const enrichedWithdrawals = withdrawalsData?.map(w => ({
        ...w,
        user: usersMap.get(w.user_id)
      })) || [];

      const pendingWithdrawals = withdrawalsData?.filter(w => w.status === 'pending').length || 0;
      const totalWithdrawalsAmount = withdrawalsData?.filter(w => w.status === 'paid').reduce((sum, w) => sum + w.amount, 0) || 0;

      setStats({
        totalUsers: users?.length || 0,
        totalAdsWatched,
        dailyAdsWatched: 0, // Would need daily tracking
        totalWheelSpins: users?.filter(u => u.last_wheel_spin).length || 0,
        totalGamesPlayed: gamesCount || 0,
        pendingWithdrawals,
        totalWithdrawalsAmount,
      });

      setWithdrawals(enrichedWithdrawals);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject' | 'pay') => {
    setProcessingId(withdrawalId);
    try {
      const newStatus = action === 'approve' ? 'approved' : action === 'pay' ? 'paid' : 'rejected';
      
      const { error } = await supabase
        .from('withdrawals')
        .update({ 
          status: newStatus,
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      // If rejected, return coins to user
      if (action === 'reject') {
        const withdrawal = withdrawals.find(w => w.id === withdrawalId);
        if (withdrawal) {
          const { data: userData } = await supabase
            .from('users')
            .select('total_winnings')
            .eq('id', withdrawal.user_id)
            .single();

          if (userData) {
            await supabase
              .from('users')
              .update({ total_winnings: userData.total_winnings + withdrawal.amount })
              .eq('id', withdrawal.user_id);
          }
        }
      }

      hapticFeedback('success');
      toast.success(
        action === 'approve' ? 'So\'rov tasdiqlandi' :
        action === 'pay' ? 'To\'lov amalga oshirildi' :
        'So\'rov rad etildi'
      );
      
      await fetchData();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Kutilmoqda</span>;
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">Tasdiqlangan</span>;
      case 'paid':
        return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">To'langan</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">Rad etilgan</span>;
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
      <div className="px-4 py-3 border-b border-glass-border">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('stats')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
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
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
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
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        <AnimatePresence mode="wait">
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
                  <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.totalAdsWatched}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.totalWheelSpins}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.totalGamesPlayed}</p>
                  <p className="text-xs text-muted-foreground">Jami o'yinlar</p>
                </motion.div>
              </div>

              {/* Financial Stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
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
                    <p className="text-xl font-bold text-green-700">{stats.totalWithdrawalsAmount} tanga</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeSection === 'withdrawals' && (
            <motion.div
              key="withdrawals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {withdrawals.length === 0 ? (
                <div className="glass-card-elevated p-8 text-center">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Hozircha so'rovlar yo'q</p>
                </div>
              ) : (
                withdrawals.map((withdrawal, index) => (
                  <motion.div
                    key={withdrawal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass-card-elevated p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {withdrawal.user?.first_name} {withdrawal.user?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{withdrawal.user?.username || 'username yo\'q'} • ID: {withdrawal.user?.telegram_id}
                        </p>
                      </div>
                      {getStatusBadge(withdrawal.status)}
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Miqdor:</span>
                      <span className="font-bold text-foreground">{withdrawal.amount} tanga</span>
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
                          onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                          disabled={processingId === withdrawal.id}
                          className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Rad etish
                        </button>
                      </div>
                    )}

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
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
