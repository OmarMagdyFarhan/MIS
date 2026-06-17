import React from 'react';
import { AlertCircle, Save, CopyPlus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOverwrite: () => void;
  onCreateNew: () => void;
  title: string;
  description: string;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  onOverwrite,
  onCreateNew,
  title,
  description
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#1D1D1F]/40 backdrop-blur-xl" 
            onClick={onClose} 
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            className="relative bg-[var(--color-card-bg)]/95 backdrop-blur-2xl rounded-[var(--radius-full)] w-full max-w-[480px] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.2)] overflow-hidden border border-white/20"
          >
            <div className="p-12 pb-6 flex justify-between items-start">
              <div className="w-16 h-16 bg-[#0A84FF]/5 text-[#0A84FF] rounded-[var(--radius-md)] flex items-center justify-center shadow-inner">
                <AlertCircle size={32} strokeWidth={2.5} />
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-[var(--color-card-bg)] rounded-full transition-all text-[#86868B] hover:text-[var(--color-text-primary)] active:scale-90"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="px-12 pb-6 space-y-4">
              <h3 className="text-[var(--text-xl)] font-display font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h3>
              <p className="text-[var(--text-base)] text-[#86868B] font-medium leading-relaxed mb-6 opacity-80">
                {description}
              </p>
              
              <div className="space-y-4 pt-4">
                <button
                  onClick={onOverwrite}
                  className="w-full flex items-center justify-between p-6 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] border-[#0A84FF] bg-[#0A84FF]/[0.02] hover:bg-[#0A84FF]/5 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-[var(--text-lg)] text-[#0A84FF] flex items-center gap-3">
                      <Save size={18} strokeWidth={2.5} />
                      Commit & Overwrite
                    </div>
                    <p className="text-[var(--text-sm)] text-[#0A84FF]/60 pl-8 leading-tight">Update the current master profile with these modifications.</p>
                  </div>
                </button>
                
                <button
                  onClick={onCreateNew}
                  className="w-full flex items-center justify-between p-6 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] border-[var(--color-border-secondary)] hover:border-[var(--color-border-secondary)] bg-[var(--color-card-bg)] transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-[var(--text-lg)] text-[var(--color-text-primary)] flex items-center gap-3">
                      <CopyPlus size={18} strokeWidth={2.5} />
                      Create Parallel Project
                    </div>
                    <p className="text-[var(--text-sm)] text-[#86868B] pl-8 leading-tight">Preserve the source and branch into a new project entry.</p>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="p-12 pt-6 bg-[var(--color-card-bg)]/30 border-t border-[var(--color-border-default)] flex justify-end">
              <button 
                onClick={onClose}
                className="text-[var(--text-base)] font-semibold uppercase tracking-[0.06em] text-[#86868B] hover:text-[var(--color-text-primary)] transition-all px-8 py-4 hover:scale-105"
              >
                Abort
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
