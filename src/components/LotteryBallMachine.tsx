import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface Ball {
  id: number;
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface LotteryBallMachineProps {
  targetNumbers: number[];
  onBallDrawn: (number: number, index: number) => void;
  onComplete: () => void;
  maxNumbers: number;
}

export const LotteryBallMachine = ({ 
  targetNumbers, 
  onBallDrawn, 
  onComplete,
  maxNumbers 
}: LotteryBallMachineProps) => {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  const [exitingBall, setExitingBall] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(true);
  const animationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize balls
  useEffect(() => {
    const initialBalls: Ball[] = [];
    for (let i = 1; i <= 42; i++) {
      initialBalls.push({
        id: i,
        value: i,
        x: 60 + Math.random() * 80,
        y: 60 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
      });
    }
    setBalls(initialBalls);
  }, []);

  // Physics simulation
  useEffect(() => {
    if (!isSpinning) return;

    const animate = () => {
      setBalls(prevBalls => {
        return prevBalls.map(ball => {
          if (drawnBalls.includes(ball.value)) return ball;

          let newX = ball.x + ball.vx;
          let newY = ball.y + ball.vy;
          let newVx = ball.vx;
          let newVy = ball.vy;

          // Circular container bounds (radius ~90)
          const centerX = 100;
          const centerY = 100;
          const radius = 85;
          const ballRadius = 12;

          const dx = newX - centerX;
          const dy = newY - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > radius - ballRadius) {
            // Bounce off circular wall
            const normalX = dx / distance;
            const normalY = dy / distance;
            const dotProduct = newVx * normalX + newVy * normalY;
            newVx = newVx - 2 * dotProduct * normalX * 0.8;
            newVy = newVy - 2 * dotProduct * normalY * 0.8;
            newX = centerX + normalX * (radius - ballRadius);
            newY = centerY + normalY * (radius - ballRadius);
          }

          // Add gravity toward center (swirl effect)
          const gravityStrength = 0.02;
          newVx -= (newX - centerX) * gravityStrength * 0.01;
          newVy -= (newY - centerY) * gravityStrength * 0.01;

          // Random turbulence
          newVx += (Math.random() - 0.5) * 0.3;
          newVy += (Math.random() - 0.5) * 0.3;

          // Speed limit
          const speed = Math.sqrt(newVx * newVx + newVy * newVy);
          const maxSpeed = 5;
          if (speed > maxSpeed) {
            newVx = (newVx / speed) * maxSpeed;
            newVy = (newVy / speed) * maxSpeed;
          }

          return { ...ball, x: newX, y: newY, vx: newVx, vy: newVy };
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpinning, drawnBalls]);

  // Draw balls one by one - FASTER timing
  useEffect(() => {
    if (drawnBalls.length >= maxNumbers) {
      setIsSpinning(false);
      setTimeout(onComplete, 300);
      return;
    }

    const nextNumber = targetNumbers[drawnBalls.length];
    if (nextNumber === undefined) return;

    const timer = setTimeout(() => {
      setExitingBall(nextNumber);
      
      setTimeout(() => {
        setDrawnBalls(prev => [...prev, nextNumber]);
        onBallDrawn(nextNumber, drawnBalls.length);
        setExitingBall(null);
      }, 400); // Faster exit animation
    }, drawnBalls.length === 0 ? 800 : 600); // Faster initial delay and between balls

    return () => clearTimeout(timer);
  }, [drawnBalls, targetNumbers, maxNumbers, onBallDrawn, onComplete]);

  const ballColors = [
    { from: '#f59e0b', to: '#d97706', border: '#fcd34d' }, // Amber
    { from: '#ef4444', to: '#dc2626', border: '#fca5a5' }, // Red
    { from: '#3b82f6', to: '#2563eb', border: '#93c5fd' }, // Blue
    { from: '#10b981', to: '#059669', border: '#6ee7b7' }, // Green
    { from: '#8b5cf6', to: '#7c3aed', border: '#c4b5fd' }, // Purple
    { from: '#ec4899', to: '#db2777', border: '#f9a8d4' }, // Pink
  ];

  const getBallColor = (num: number) => ballColors[num % ballColors.length];

  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Lottery Machine */}
      <div className="relative">
        {/* Outer ring glow */}
        <motion.div
          className="absolute -inset-4 rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, hsl(38 92% 50% / 0.3) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Main container */}
        <div 
          ref={containerRef}
          className="relative w-52 h-52 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsl(220 25% 97%) 0%, hsl(220 20% 90%) 100%)',
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.15)',
            border: '4px solid hsl(38 92% 60% / 0.4)',
          }}
        >
          {/* Inner glass effect */}
          <div 
            className="absolute inset-2 rounded-full"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.05) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Balls */}
          {balls.map((ball) => {
            if (drawnBalls.includes(ball.value)) return null;
            const color = getBallColor(ball.value);
            const isExiting = exitingBall === ball.value;

            return (
              <motion.div
                key={ball.id}
                className="absolute flex items-center justify-center text-white font-bold text-xs rounded-full shadow-lg"
                style={{
                  width: 28,
                  height: 28,
                  left: ball.x - 14,
                  top: ball.y - 14,
                  background: `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`,
                  border: `2px solid ${color.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.4)',
                  zIndex: isExiting ? 100 : 1,
                }}
                animate={isExiting ? {
                  x: [0, 0, 80],
                  y: [0, -60, -120],
                  scale: [1, 1.3, 1.5],
                  opacity: [1, 1, 0],
                } : {}}
                transition={isExiting ? { duration: 0.8, ease: 'easeOut' } : {}}
              >
                <span className="relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {ball.value}
                </span>
                {/* Shine effect */}
                <div
                  className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white/60"
                  style={{ filter: 'blur(1px)' }}
                />
              </motion.div>
            );
          })}

          {/* Center spin indicator */}
          {isSpinning && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
              }}
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, scale: { duration: 1, repeat: Infinity } }}
            />
          )}
        </div>

        {/* Exit tube */}
        <div 
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-20 h-12 rounded-r-full z-10"
          style={{
            background: 'linear-gradient(180deg, hsl(220 25% 92%) 0%, hsl(220 20% 85%) 100%)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '3px solid hsl(38 92% 60% / 0.3)',
            borderLeft: 'none',
          }}
        >
          <div className="absolute inset-0 rounded-r-full overflow-hidden">
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 100%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Drawn balls display */}
      <div className="flex justify-center gap-3 flex-wrap min-h-[60px]">
        {Array.from({ length: maxNumbers }).map((_, i) => (
          <div key={i} className="relative">
            <AnimatePresence mode="wait">
              {drawnBalls[i] !== undefined ? (
                <motion.div
                  key={drawnBalls[i]}
                  initial={{ y: -80, scale: 0, rotate: -180 }}
                  animate={{ y: 0, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                  className="relative"
                >
                  {(() => {
                    const color = getBallColor(drawnBalls[i]);
                    return (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg relative"
                        style={{
                          background: `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`,
                          border: `3px solid ${color.border}`,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 -3px 6px rgba(0,0,0,0.2), inset 0 3px 6px rgba(255,255,255,0.4)',
                        }}
                      >
                        <span style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{drawnBalls[i]}</span>
                        <div className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-white/50" style={{ filter: 'blur(2px)' }} />
                      </div>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{
                    background: 'linear-gradient(180deg, hsl(220 20% 94%) 0%, hsl(220 20% 88%) 100%)',
                    border: '2px dashed hsl(220 20% 70%)',
                    color: 'hsl(220 15% 60%)',
                  }}
                >
                  ?
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: maxNumbers }).map((_, i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-colors"
            style={{
              background: i < drawnBalls.length 
                ? 'linear-gradient(135deg, hsl(38 92% 50%) 0%, hsl(25 95% 53%) 100%)'
                : 'hsl(220 20% 85%)',
            }}
            animate={i < drawnBalls.length ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
};
