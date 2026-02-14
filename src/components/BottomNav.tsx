import { motion } from 'framer-motion';
import { Gamepad2, Egg, ListTodo, History, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'lottery', label: 'O\'yin', icon: Gamepad2 },
  { id: 'egg', label: 'Tuxum', icon: Egg },
  { id: 'mystery', label: 'Vazifalar', icon: ListTodo },
  { id: 'history', label: 'Tarix', icon: History },
  { id: 'profile', label: 'Profil', icon: User },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-1 py-1.5 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <motion.div
                className="relative z-10"
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              </motion.div>
              <span className={`text-[9px] font-medium relative z-10 mt-0.5 ${isActive ? 'text-primary' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
