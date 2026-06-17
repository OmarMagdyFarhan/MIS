import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TransitionWrapperProps {
  children: React.ReactNode;
  id: string | number;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({ children, id }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
