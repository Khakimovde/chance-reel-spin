import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomNav } from '@/components/BottomNav';
import { LotteryTab } from '@/components/LotteryTab';
import { WheelTab } from '@/components/WheelTab';
import { MysteryTab } from '@/components/MysteryTab';
import { HistoryTab } from '@/components/HistoryTab';
import { ProfileTab } from '@/components/ProfileTab';
import { AdminPanel } from '@/components/AdminPanel';
import { useTelegram } from '@/hooks/useTelegram';
import { initTelegramApp, getTelegramUser } from '@/lib/telegram';
import { Coins, Shield } from 'lucide-react';

const ADMIN_TELEGRAM_ID = 5326022510;

const Index = () => {
  const [activeTab, setActiveTab] = useState('lottery');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { user } = useTelegram();
  
  // Check if current user is admin
  const telegramUser = getTelegramUser();
  const isAdmin = telegramUser?.id === ADMIN_TELEGRAM_ID;

  useEffect(() => {
    initTelegramApp();
  }, []);

  // Use user's backend-synced data
  const coins = user?.coins ?? 0;

  const renderTab = () => {
    switch (activeTab) {
      case 'lottery':
        return <LotteryTab />;
      case 'wheel':
        return <WheelTab />;
      case 'mystery':
        return <MysteryTab />;
      case 'history':
        return <HistoryTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return <LotteryTab />;
    }
  };

  // If admin panel is open, show it
  if (showAdminPanel) {
    return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
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
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 px-3 py-1.5 rounded-full"
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
