import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/BottomNav';
import { LotteryTab } from '@/components/LotteryTab';
import { useTelegram } from '@/hooks/useTelegram';
import { initTelegramApp, getTelegramUser } from '@/lib/telegram';
import { Coins, Shield, Loader2 } from 'lucide-react';

// Lazy load non-critical tabs for faster initial load
const LeaderboardTab = lazy(() => import('@/components/LeaderboardTab').then(m => ({ default: m.LeaderboardTab })));
const MysteryTab = lazy(() => import('@/components/MysteryTab').then(m => ({ default: m.MysteryTab })));
const HistoryTab = lazy(() => import('@/components/HistoryTab').then(m => ({ default: m.HistoryTab })));
const ProfileTab = lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })));
const AdminPanel = lazy(() => import('@/components/AdminPanel').then(m => ({ default: m.AdminPanel })));

const ADMIN_TELEGRAM_ID = 5326022510;

// Loading fallback component
const TabLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState('lottery');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { user, refreshUserData } = useTelegram();
  
  // Check if current user is admin - memoized
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const isAdmin = telegramUser?.id === ADMIN_TELEGRAM_ID;

  useEffect(() => {
    initTelegramApp();
  }, []);

  // Refresh user data every 30 seconds to reduce DB load
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUserData();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshUserData]);

  // Use user's backend-synced data - updates in real-time now
  const coins = user?.coins ?? 0;

  // Memoized tab renderer for performance
  const renderTab = useCallback(() => {
    switch (activeTab) {
      case 'lottery':
        return <LotteryTab />;
      case 'leaderboard':
        return <Suspense fallback={<TabLoader />}><LeaderboardTab /></Suspense>;
      case 'mystery':
        return <Suspense fallback={<TabLoader />}><MysteryTab /></Suspense>;
      case 'history':
        return <Suspense fallback={<TabLoader />}><HistoryTab /></Suspense>;
      case 'profile':
        return <Suspense fallback={<TabLoader />}><ProfileTab /></Suspense>;
      default:
        return <LotteryTab />;
    }
  }, [activeTab]);

  // If admin panel is open, show it
  if (showAdminPanel) {
    return <Suspense fallback={<TabLoader />}><AdminPanel onBack={() => setShowAdminPanel(false)} /></Suspense>;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-glass-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={user?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.first_name || 'User'}`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full user-avatar"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success border-2 border-background flex items-center justify-center">
                  <span className="text-[8px]">✓</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm leading-tight">
                  {user?.first_name || 'O\'yinchi'}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  ID: {user?.id || '123456'}
                </span>
              </div>
            </div>

            {/* Balance Card and Admin Button */}
            <div className="flex items-center gap-2">
              {isAdmin && (
                <motion.button
                  onClick={() => setShowAdminPanel(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50 px-3 py-1.5 rounded-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center">
                    <Shield className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-red-700">Admin</span>
                </motion.button>
              )}
              <motion.div 
                key={coins} // Force re-render on coins change
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 px-3 py-1.5 rounded-full"
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Coins className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-amber-700">{coins.toLocaleString()}</span>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
