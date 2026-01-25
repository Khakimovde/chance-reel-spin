// Sound effects for the game

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds() {
    // Create audio elements for wheel sounds
    const wheelTick = new Audio();
    wheelTick.src = 'data:audio/wav;base64,UklGRl9vT19telegramWAVEZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 
      'FVT' + 'A'.repeat(100);
    this.sounds.set('wheelTick', wheelTick);
  }

  // Generate wheel tick sound using Web Audio API
  playWheelTick() {
    if (!this.enabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800 + Math.random() * 200;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch (e) {
      console.log('Audio not available');
    }
  }

  // Play win celebration sound
  playWinSound() {
    if (!this.enabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        }, i * 100);
      });
    } catch (e) {
      console.log('Audio not available');
    }
  }

  // Play spinning wheel sound
  playSpinSound(duration: number = 5000) {
    if (!this.enabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const tickCount = 40;
      
      for (let i = 0; i < tickCount; i++) {
        const delay = (i / tickCount) * duration * (1 + i / tickCount);
        
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 600 + Math.random() * 400;
          oscillator.type = 'triangle';
          
          const volume = 0.05 + (i / tickCount) * 0.1;
          gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.08);
        }, delay);
      }
    } catch (e) {
      console.log('Audio not available');
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const soundManager = new SoundManager();
