import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Building2, AlertTriangle, Upload, Image as ImageIcon, Globe, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { MARKET_PROFILES } from '../services/marketContext';

interface CompanyStep {
  title: string;
  description: string;
  placeholder: string;
  key: string;
}

const STEPS: CompanyStep[] = [
  {
    key: 'name',
    title: "Project Name",
    description: "What's the name of the company or initiative?",
    placeholder: "e.g. Acme Corp"
  },
  {
    key: 'industry',
    title: "Industry",
    description: "What sector does this business operate in?",
    placeholder: "e.g. Sustainable Fashion"
  },
  {
    key: 'usp',
    title: "Your USP",
    description: "What makes your offer unique?",
    placeholder: "Describe your secret sauce..."
  }
];


interface CompanyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftCompany: any;
  onUpdateDraft: (key: string, value: any) => void;
  onSave: () => void;
  isOfferComplete?: boolean;
}

export const CompanyEditorModal: React.FC<CompanyEditorModalProps> = ({
  isOpen,
  onClose,
  draftCompany,
  onUpdateDraft,
  onSave,
  isOfferComplete
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateDraft('logoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (

    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-[#1D1D1F]/40 backdrop-blur-xl"
          />
          
          <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative bg-[var(--color-card-bg)]/95 backdrop-blur-2xl w-full max-w-lg rounded-[var(--radius-md)] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.15)] overflow-hidden max-h-[90vh] flex flex-col border border-white/20"
          >
            <div className="p-10 pb-6 flex justify-between items-center bg-[var(--color-card-bg)]/50 border-b border-[var(--color-border-default)]">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[#0A84FF]/5 text-[#0A84FF] flex items-center justify-center shadow-inner">
                        <Building2 size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight leading-none text-[var(--color-text-primary)]">Company Profile</h2>
                        <p className="text-[var(--text-base)] text-[#86868B] font-medium mt-1.5 opacity-60">Brand identity & market logic</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-[var(--color-card-bg)] rounded-full transition-all active:scale-95 group">
                    <X size={20} className="text-[#86868B] group-hover:text-[var(--color-text-primary)]" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 pt-8 no-scrollbar">
                {isOfferComplete && (
                    <div className="mb-10 p-6 bg-amber-50 rounded-[var(--radius-md)] border border-amber-100 flex gap-4 items-start shadow-sm">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} strokeWidth={2.5} />
                        <div>
                            <p className="text-[var(--text-base)] font-semibold text-amber-800 uppercase tracking-[0.06em] leading-none mb-2">Active Synthesis Warning</p>
                            <p className="text-[var(--text-sm)] text-amber-700 leading-relaxed font-medium">
                                Modifications to core brand variables may invalidate your current strategic offer. Review carefully after saving.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-10">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <label className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] leading-none opacity-40">
                                Visual Identity / Logo
                            </label>
                            {draftCompany.logoUrl && (
                                <button 
                                    onClick={() => {
                                        if (confirm("Remove this logo? This cannot be undone.")) {
                                            onUpdateDraft('logoUrl', '');
                                        }
                                    }}
                                    className="text-[var(--text-xs)] font-semibold text-[#FF3B30] uppercase tracking-[0.06em] hover:opacity-70 transition-opacity"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-8">
                            <div className="w-28 h-28 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] flex items-center justify-center p-3 overflow-hidden shrink-0 shadow-inner group/logo">
                                {draftCompany.logoUrl ? (
                                    <img src={draftCompany.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain transition-transform group-hover/logo:scale-110 duration-500" referrerPolicy="no-referrer" />
                                ) : (
                                    <ImageIcon size={32} className="text-[#D2D2D7]" />
                                )}
                            </div>
                            
                            <div className="flex-1 space-y-4">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[var(--color-card-bg)] text-[var(--color-text-primary)] rounded-[var(--radius-md)] text-[var(--text-base)] font-bold hover:bg-[#E8E8ED] transition-all border border-[var(--color-border-secondary)] active:scale-95"
                                >
                                    <Upload size={18} strokeWidth={2.5} />
                                    {draftCompany.logoUrl ? 'Update Brandmark' : 'Upload Brandmark'}
                                </button>
                                <div className="relative group/input">
                                    <input
                                        type="text"
                                        value={draftCompany.logoUrl?.startsWith('data:') ? '' : (draftCompany.logoUrl || '')}
                                        onChange={(e) => onUpdateDraft('logoUrl', e.target.value)}
                                        placeholder="Remote URL path..."
                                        className="w-full px-6 py-3 bg-[var(--color-card-bg)]/30 border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium outline-none focus:bg-[var(--color-card-bg)] focus:border-[#0A84FF] transition-all placeholder:text-[#86868B]/40"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                                        <Globe size={14} />
                                    </div>
                                </div>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Market Intelligence Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] px-2 opacity-40">
                                Geo-Market Focus
                            </label>
                            <div className="relative group/select">
                                <select
                                    value={draftCompany.country || 'Global'}
                                    onChange={(e) => onUpdateDraft('country', e.target.value)}
                                    className="w-full px-6 py-4 bg-[var(--color-card-bg)]/50 border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] focus:border-[#0A84FF] focus:bg-[var(--color-card-bg)] outline-none transition-all text-[var(--text-base)] font-bold appearance-none cursor-pointer pr-12"
                                >
                                    {Object.keys(MARKET_PROFILES).map(c => (
                                        <option key={c} value={c}>{c === 'Global' ? 'Global Neural Engine' : c}</option>
                                    ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#0A84FF]">
                                    <Globe size={18} strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] px-2 opacity-40">
                                Digital Footprint
                            </label>
                            <div className="relative group/input">
                                <input
                                    type="url"
                                    value={draftCompany.websiteUrl || ''}
                                    onChange={(e) => onUpdateDraft('websiteUrl', e.target.value)}
                                    placeholder="brand.com"
                                    className="w-full px-6 py-4 bg-[var(--color-card-bg)]/50 border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] focus:border-[#0A84FF] focus:bg-[var(--color-card-bg)] outline-none transition-all text-[var(--text-base)] font-bold placeholder:text-[#86868B]/30"
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#D2D2D7]">
                                    <Sparkles size={18} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {draftCompany.country === 'Global' && (
                        <div className="mx-2 p-4 bg-amber-50 rounded-[var(--radius-md)] border border-amber-100 flex items-center gap-4 shadow-sm">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0" strokeWidth={2.5} />
                            <p className="text-[var(--text-sm)] text-amber-800 font-bold leading-tight">
                                Neural Engine prioritizing US benchmarks for maximum strategic authority.
                            </p>
                        </div>
                    )}

                    {STEPS.map((s) => (

                        <div key={s.key} className="space-y-3">
                            <label className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] px-2 opacity-40">
                                {s.title}
                            </label>
                            {s.key === 'usp' ? (
                                <textarea
                                    value={draftCompany[s.key] || ''}
                                    onChange={(e) => onUpdateDraft(s.key, e.target.value)}
                                    placeholder={s.placeholder}
                                    className="w-full h-32 px-6 py-5 bg-[var(--color-card-bg)]/50 border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] focus:border-[#0A84FF] focus:bg-[var(--color-card-bg)] outline-none transition-all text-[var(--text-base)] leading-relaxed resize-none font-medium placeholder:text-[#86868B]/30"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={draftCompany[s.key] || ''}
                                    onChange={(e) => onUpdateDraft(s.key, e.target.value)}
                                    placeholder={s.placeholder}
                                    className="w-full px-6 py-5 bg-[var(--color-card-bg)]/50 border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] focus:border-[#0A84FF] focus:bg-[var(--color-card-bg)] outline-none transition-all text-[var(--text-base)] font-bold placeholder:text-[#86868B]/30"
                                />
                            )}
                            <p className="text-[var(--text-sm)] text-[#86868B] px-2 font-medium opacity-60 tracking-tight">{s.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-10 pt-6 bg-[var(--color-card-bg)]/30 border-t border-[var(--color-border-default)] flex items-center justify-end gap-6">
                <button 
                    onClick={() => {
                        if (confirm("Discard all unsaved changes to this profile?")) {
                            onClose();
                        }
                    }}
                    className="px-6 py-4 text-[var(--text-base)] font-bold text-[#86868B] hover:text-[var(--color-text-primary)] transition-all hover:scale-105"
                >
                    Discard Changes
                </button>
                <button
                    onClick={onSave}
                    disabled={!draftCompany.name || !draftCompany.industry}
                    className="flex-1 md:flex-none btn-primary px-10 h-14 flex items-center justify-center gap-3 rounded-[var(--radius-md)] text-[var(--text-base)] shadow-[0_20px_40px_-10px_rgba(10,132,255,0.3)] shadow-[#0A84FF]/30"
                >
                    Apply Modifications
                    <ChevronRight size={20} strokeWidth={3} />
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
