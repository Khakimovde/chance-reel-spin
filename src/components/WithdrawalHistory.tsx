import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTelegram } from '@/hooks/useTelegram';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Wallet,
  Banknote,
  AlertCircle
} from 'lucide-react';

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  wallet_address: string | null;
  created_at: string;
  processed_at: string | null;
}

export const WithdrawalHistory = () => {
  const { user } = useTelegram();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchWithdrawals();
    }
  }, [user?.id]);

  const fetchWithdrawals = async () => {
    try {
      // First get user's UUID from telegram_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', user?.id)
        .maybeSingle();

      if (userError || !userData) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWithdrawals(data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approved':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Kutilmoqda';
      case 'approved':
        return 'Tasdiqlangan';
      case 'paid':
        return 'To\'langan';
      case 'rejected':
        return 'Rad etilgan';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-blue-100 text-blue-700';
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="glass-card-elevated p-6 text-center">
        <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Hozircha so'rovlar yo'q</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {withdrawals.map((withdrawal, index) => (
        <motion.div
          key={withdrawal.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-3 bg-muted/50 rounded-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-green-500" />
              <span className="font-semibold text-foreground">{withdrawal.amount} tanga</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${getStatusColor(withdrawal.status)}`}>
              {getStatusIcon(withdrawal.status)}
              {getStatusText(withdrawal.status)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {new Date(withdrawal.created_at).toLocaleString('uz-UZ')}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
