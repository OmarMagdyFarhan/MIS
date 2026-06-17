import React from 'react';
import { Building2, Upload, X, Image as ImageIcon, Globe, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { StepLayout } from './StepLayout';
import { MARKET_PROFILES } from '../../services/marketContext';

interface Step1NameProps {
  name: string;
  logoUrl: string;
  country: string;
  websiteUrl: string;
  onNameChange: (val: string) => void;
  onLogoChange: (val: string) => void;
  onCountryChange: (val: string) => void;
  onWebsiteChange: (val: string) => void;
  onContinue: () => void;
  onStepNav: (step: number) => void;
  isStageComplete?: boolean;
}

export const Step1Name: React.FC<Step1NameProps> = ({ 
  name, 
  logoUrl,
  country,
  websiteUrl,
  onNameChange, 
  onLogoChange,
  onCountryChange,
  onWebsiteChange,
  onContinue, 
  onStepNav, 
  isStageComplete 
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onLogoChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <StepLayout
      step={1}
      totalSteps={4}
      stepName="Company"
      title="Your company"
      description="Tell us about your company. This grounds everything we build next."
      onStepNav={onStepNav}
      isStageComplete={isStageComplete}
      logoUrl={logoUrl}
      footer={
        <button
          disabled={!name.trim()}
          onClick={onContinue}
          className="btn-primary w-full py-5 text-[var(--text-base)] group"
        >
          Continue
          <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      }
    >
      <div className="flex flex-col items-center gap-10 max-w-[540px] mx-auto pb-12">
        <div className="w-full space-y-4">
            <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.06em] px-1 text-center block opacity-60">Company Designation</span>
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Acme Strategic"
                className="input-premium w-full text-center text-[var(--text-xl)] font-display font-extrabold py-8"
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && onContinue()}
            />
        </div>

        <div className="w-full space-y-12 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group space-y-4">
                    <label className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.4em] px-2 block transition-opacity group-focus-within:opacity-100">Primary Market</label>
                    <div className="relative">
                        <select
                            value={country}
                            onChange={(e) => onCountryChange(e.target.value)}
                            className="input-premium w-full py-6 px-7 text-[var(--text-base)] font-bold text-[var(--color-text-primary)] appearance-none cursor-pointer pr-14 bg-[var(--color-slate-elevated)]/30"
                        >
                            {Object.keys(MARKET_PROFILES).map(c => (
                                <option key={c} value={c} className="bg-[var(--color-card-bg)] text-[var(--color-text-primary)]">{c === 'Global' ? 'Global Baseline' : c.toUpperCase()}</option>
                            ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#0A84FF]">
                            <Globe size={22} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>

                <div className="group space-y-4">
                    <label className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.4em] px-2 block transition-opacity group-focus-within:opacity-100">Website URL</label>
                    <div className="relative">
                        <input
                            type="url"
                            value={websiteUrl}
                            onChange={(e) => onWebsiteChange(e.target.value)}
                            placeholder="domain.com"
                            className="input-premium w-full py-6 px-7 text-[var(--text-base)] font-bold text-[var(--color-text-primary)] pr-14 placeholder:opacity-30 bg-[var(--color-slate-elevated)]/30 font-mono"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-placeholder)] group-focus-within:text-[#0A84FF] transition-colors">
                            <Sparkles size={20} className="group-focus-within:scale-110 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {country === 'Global' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-10 bg-[#0A84FF]/5 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] border-[#0A84FF]/20 space-y-6 relative overflow-hidden"
              >
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Globe size={120} />
                 </div>
                 <div className="flex items-center gap-6 relative z-10 text-left">
                    <div className="w-16 h-16 bg-[#0A84FF] text-white rounded-[var(--radius-md)] shadow-xl shadow-[#0A84FF]/20 flex items-center justify-center shrink-0">
                        <Globe size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1 content-left">
                        <h4 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] uppercase tracking-tight">Using US market benchmarks</h4>
                        <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] font-medium leading-relaxed max-w-[400px]">
                            Your results are benchmarked against <span className="text-[#0A84FF] font-semibold">US market data</span> so your results are comparable.
                        </p>
                    </div>
                 </div>
              </motion.div>
            )}
        </div>

        <div className="w-full space-y-6">
            <div className="flex items-center justify-between px-2">
                <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.06em] opacity-60">Visual Identity</span>
                {logoUrl && (
                    <button 
                        onClick={() => onLogoChange('')}
                        className="text-[var(--text-xs)] font-semibold text-rose-500 uppercase tracking-[0.06em] hover:opacity-70 transition-opacity"
                    >
                        Remove
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {logoUrl ? (
                    <div className="relative group aspect-[2.5/1] bg-[var(--color-slate-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] flex items-center justify-center p-10 overflow-hidden shadow-inner">
                        <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-[#000000]/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-700 flex flex-col items-center justify-center gap-4">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[var(--color-card-bg)] text-[var(--color-text-primary)] px-8 py-3.5 rounded-full text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] flex items-center gap-3 shadow-2xl active:scale-95 transition-all hover:bg-[#0A84FF] hover:text-white"
                            >
                                <Upload size={18} />
                                Re-upload Asset
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[2.5/1] bg-[var(--color-slate-elevated)] hover:bg-[var(--color-card-bg)] border-[var(--color-border-secondary)] border-dashed border-[var(--color-border-default)] hover:border-[#0A84FF]/40 rounded-[var(--radius-md)] transition-all duration-500 flex flex-col items-center justify-center gap-5 group"
                    >
                        <div className="w-16 h-16 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] shadow-xl shadow-black/5 flex items-center justify-center text-[var(--color-text-placeholder)] group-hover:text-[#0A84FF] transition-all group-hover:scale-110 border border-[var(--color-border-default)]">
                            <ImageIcon size={32} strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <div className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] tracking-tight">Upload logo</div>
                            <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-semibold uppercase tracking-[0.06em] mt-1 opacity-60">Scalable Assets Preferred (PNG/SVG)</div>
                        </div>
                    </button>
                )}

                <div className="relative py-4">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center px-4 pointer-events-none">
                        <div className="w-full h-[1px] bg-[var(--color-border-default)]" />
                        <span className="bg-[var(--color-primary-bg)] px-5 text-[var(--text-xs)] font-semibold text-[var(--color-text-placeholder)] uppercase tracking-[0.4em] shrink-0">External Source</span>
                        <div className="w-full h-[1px] bg-[var(--color-border-default)]" />
                    </div>
                </div>

                <input
                    type="url"
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    onChange={(e) => onLogoChange(e.target.value)}
                    placeholder="https://asset-repository.cdn/logo.png"
                    className="input-premium w-full text-center py-5 text-[var(--text-base)] font-mono"
                />
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
    </StepLayout>
  );
};

