// Ad Service using libtl.com SDK
import { getTelegramUser } from './telegram';

declare global {
  interface Window {
    show_10512676?: () => Promise<void>;
  }
}

let sdkLoaded = false;
let sdkLoadPromise: Promise<void> | null = null;

export const loadAdSdk = (): Promise<void> => {
  if (sdkLoaded) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const user = getTelegramUser();
    const userId = user?.id || 'anonymous';
    
    const script = document.createElement('script');
    script.src = '//libtl.com/sdk.js';
    script.setAttribute('data-zone', '10512676');
    script.setAttribute('data-sdk', 'show_10512676');
    script.setAttribute('data-user-id', String(userId));
    script.async = true;
    
    script.onload = () => {
      sdkLoaded = true;
      console.log('[AdService] SDK loaded for user:', userId);
      resolve();
    };
    
    script.onerror = () => {
      console.error('[AdService] Failed to load SDK');
      reject(new Error('Failed to load ad SDK'));
    };
    
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
};

export const showAd = async (): Promise<boolean> => {
  try {
    await loadAdSdk();
    
    if (window.show_10512676) {
      await window.show_10512676();
      console.log('[AdService] Ad shown successfully');
      return true;
    } else {
      console.warn('[AdService] show_10512676 not available');
      // Simulate ad for development
      await new Promise(resolve => setTimeout(resolve, 1500));
      return true;
    }
  } catch (error) {
    console.error('[AdService] Error showing ad:', error);
    // Continue anyway in development
    return true;
  }
};
