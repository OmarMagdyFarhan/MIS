/**
 * ConfettiBurst — lightweight, dependency-free confetti effect for
 * celebratory moments (Duolingo-style "first win" feedback). Pure CSS/
 * motion animation, auto-removes itself after the burst completes.
 *
 * @module src/components/ConfettiBurst
 */

import React from 'react';
import { motion } from 'motion/react';

const COLORS = ['#0A84FF', '#34C759', '#FF9F0A', '#FF375F', '#BF5AF2', '#FFD60A'];

interface Piece {
  id: number;
  x: number;
  rotate: number;
  color: string;
  delay: number;
  size: number;
}

function generatePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 600,
    rotate: Math.random() * 720 - 360,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.2,
    size: 6 + Math.random() * 6,
  }));
}

export const ConfettiBurst: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const pieces = React.useMemo(() => generatePieces(count), [count]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[250] overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: '50vw', y: '40vh', opacity: 1, rotate: 0 }}
          animate={{
            x: `calc(50vw + ${p.x}px)`,
            y: '110vh',
            opacity: 0,
            rotate: p.rotate,
          }}
          transition={{ duration: 1.6 + Math.random() * 0.6, delay: p.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};
