import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '@/hooks/useTelegram';
import { TrustBadge } from './TrustBadge';
import { WithdrawalHistory } from './WithdrawalHistory';
import { supabase } from '@/integrations/supabase/client';
import { 
  Coins, 
  Copy, 
  Users, 
  Gift,
  ChevronRight,
  Wallet,
  Banknote,
  CreditCard,
  AlertCircle,
  Loader2,
  History
} from 'lucide-react';
import { hapticFeedback } from '@/lib/telegram';
import { toast } from 'sonner';

export const ProfileTab = () => {
  const { user, isLoading, refreshUserData } = useTelegram();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use ONLY backend data - coins is main balance, total_winnings is withdrawable
  const coins = user?.coins ?? 0;  // Asosiy umumiy balans
  const tickets = user?.tickets ?? 0;
  const referralCount = user?.referral_count ?? 0;
  const totalWinnings = user?.total_winnings ?? 0;  // Yechib olish mumkin bo'lgan balans

  const referralLink = `https://t.me/Luckygame_robot?start=ref_${user?.id || ''}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    hapticFeedback('success');
    toast.success('Referal havolasi nusxalandi!');
  };

  const shareToTelegram = () => {
    const text = encodeURIComponent('🎰 Lotereya o\'yiniga qo\'shiling va yutib oling!');
    const url = encodeURIComponent(referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    hapticFeedback('medium');
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    const MIN_WITHDRAWAL = 5000;
    
    if (!amount || amount < MIN_WITHDRAWAL) {
      toast.error(`Minimal yechish: ${MIN_WITHDRAWAL.toLocaleString()} tanga (${(MIN_WITHDRAWAL * 2).toLocaleString()} so'm)`);
      return;
    }
    if (amount > totalWinnings) {
      toast.error('Yetarli mablag\' yo\'q');
      return;
    }
    if (!user?.id) {
      toast.error('Foydalanuvchi topilmadi');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('request-withdrawal', {
        body: {
          telegramId: user.id,
          amount,
          walletAddress: walletAddress || null,
        }
      });
      
      if (error) {
        throw error;
      }
      
      // Refresh user data from backend
      await refreshUserData();
      
      hapticFeedback('success');
      toast.success(`${amount} tanga yechish uchun so'rov yuborildi`);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWalletAddress('');
      setWalletAddress('');
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error('Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Profile Header - Compact */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-elevated p-4 text-center space-y-3"
      >
        <div className="flex justify-center">
          <img
            src={user?.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'User'}`}
            alt="Avatar"
            className="w-20 h-20 rounded-full shadow-lg"
            style={{ boxShadow: '0 0 0 3px hsl(217 91% 60% / 0.2)' }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {user?.first_name} {user?.last_name}
          </h2>
          {user?.username && (
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">ID: {user?.id}</p>
        </div>
        <TrustBadge variant="telegram" />
      </motion.div>

      {/* Compact Stats Row - 3 columns: Balans (coins), Referal, Yechish (total_winnings) */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Coins, value: coins, label: 'Umumiy Balans', color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: Users, value: referralCount, label: 'Referal', color: 'text-green-500', bg: 'bg-green-50' },
          { icon: Wallet, value: totalWinnings, label: 'Yechish balans', color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.03 }}
            className={`p-2.5 rounded-xl ${stat.bg} text-center`}
          >
            <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
            <p className="text-base font-bold text-foreground">{stat.value.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Referral Section */}
      <div className="glass-card-elevated p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Do'stlarni taklif qiling</h3>
              <p className="text-[10px] text-muted-foreground">Har bir taklif: 30 tanga</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 bg-muted rounded-lg px-2.5 py-2 text-xs text-muted-foreground truncate">
            {referralLink}
          </div>
          <button
            onClick={copyReferral}
            className="px-3 py-2 rounded-lg gradient-primary text-white flex items-center gap-1.5 shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={shareToTelegram}
          className="w-full py-2.5 rounded-lg bg-[#0088cc] text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          Telegramda ulashish
        </button>

        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-foreground">Taklif qilinganlar</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold text-foreground">{referralCount}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Withdrawal Section */}
      <div className="glass-card-elevated p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
            <Banknote className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Pul yechish</h3>
            <p className="text-[10px] text-muted-foreground">Yutgan pullaringizni yeching</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Mavjud balans:</span>
          </div>
          <span className="text-sm font-bold text-foreground">{totalWinnings} tanga</span>
        </div>

        <button
          onClick={() => setShowWithdrawModal(true)}
          disabled={totalWinnings < 5000}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard className="w-4 h-4" />
          Pul yechish
        </button>

        {totalWinnings < 5000 && (
          <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Minimal yechish: 5,000 tanga = 10,000 so'm
          </p>
        )}
      </div>

      {/* Withdrawal History Section */}
      <div className="glass-card-elevated p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-sm">
            <History className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Pul yechish tarixi</h3>
            <p className="text-[10px] text-muted-foreground">So'rovlaringiz holati</p>
          </div>
        </div>
        <WithdrawalHistory />
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-md rounded-t-3xl p-5 space-y-4"
            >
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-3">
                  <Banknote className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold">Pul yechish</h3>
                <p className="text-sm text-muted-foreground">Mavjud: {totalWinnings} tanga</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Miqdor</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Miqdorni kiriting..."
                  className="w-full px-4 py-3 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hamyon manzili (ixtiyoriy)</label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Hamyon manzilini kiriting..."
                  className="w-full px-4 py-3 rounded-xl bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  'Yechish'
                )}
              </button>

              <button
                onClick={() => setShowWithdrawModal(false)}
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
