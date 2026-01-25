// Telegram WebApp SDK integration
// In production, this would use the real Telegram WebApp SDK

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Mock user for development
const mockUser: TelegramUser = {
  id: 123456789,
  first_name: "Alex",
  last_name: "Johnson",
  username: "alexj",
  photo_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  language_code: "en",
};

export const getTelegramUser = (): TelegramUser | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initDataUnsafe.user || mockUser;
  }
  return mockUser;
};

export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

export const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') => {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    if (type === 'selection') {
      webApp.HapticFeedback.selectionChanged();
    } else if (['success', 'error', 'warning'].includes(type)) {
      webApp.HapticFeedback.notificationOccurred(type as 'success' | 'error' | 'warning');
    } else {
      webApp.HapticFeedback.impactOccurred(type as 'light' | 'medium' | 'heavy');
    }
  }
};

export const initTelegramApp = () => {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
};
