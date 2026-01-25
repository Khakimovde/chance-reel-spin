import { Shield, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrustBadgeProps {
  variant?: 'telegram' | 'fair';
}

export const TrustBadge = ({ variant = 'telegram' }: TrustBadgeProps) => {
  if (variant === 'telegram') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="trust-badge"
      >
        <Shield className="w-3 h-3" />
        <span>Verified by Telegram</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="trust-badge"
    >
      <CheckCircle className="w-3 h-3" />
      <span>Provably Fair</span>
    </motion.div>
  );
};
