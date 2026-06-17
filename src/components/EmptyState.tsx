import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center p-12 bg-[var(--color-card-bg)] dark:bg-[var(--color-card-bg)] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] dark:border-[var(--color-border-default)] shadow-[0_8px_40px_rgba(0,0,0,0.04)] dark:shadow-sm ${className}`}
    >
      <div className="w-14 h-14 bg-[var(--color-card-bg)] dark:bg-[var(--color-slate-elevated)] rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-secondary)] mb-6">
        <Icon size={26} strokeWidth={1.5} className="text-[var(--color-text-secondary)]" />
      </div>
      <h3 className="text-[var(--text-lg)] font-display font-semibold text-[var(--color-text-primary)] mb-2 tracking-tight">{title}</h3>
      <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] max-w-[320px] mb-8 leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};
