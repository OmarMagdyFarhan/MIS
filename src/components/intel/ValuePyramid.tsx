import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PYRAMID_STRUCTURE, ELEMENTS_OF_VALUE, ValueCategory } from '../../constants/elementsOfValue';
import { Avatar } from '../../types';
import { cn } from '../../lib/utils';
import { 
  Users, ArrowRight, ChevronRight, X, 
  Mountain, Sunrise, UserPlus, Zap, History,
  HeartPulse, Gift, Camera, Brush, Award, Flower2, Heart, Music, Magnet, Key,
  Clock, Layers, Banknote, ShieldCheck, Folder, Combine, Share2, Gauge, CheckCircle2, Tag, Star, Grid, Eye, Info, Activity
} from 'lucide-react';

interface ValuePyramidProps {
  avatars: Avatar[];
  onAvatarClick: (avatar: Avatar) => void;
}

const IconMap: Record<string, any> = {
  Mountain, Sunrise, UserPlus, Zap, History, Users,
  HeartPulse, Gift, Camera, Brush, Award, Flower2, Heart, Music, Magnet, Key,
  Clock, Layers, Banknote, ShieldCheck, Folder, Combine, Share2, Gauge, CheckCircle2, Tag, Star, Grid, Eye, Info, Activity
};

const CategoryColors: Record<ValueCategory, { border: string, text: string, bg: string, ring: string, darkBg: string }> = {
  'Social Impact': { 
    border: 'border-purple-200 dark:border-purple-500/30', 
    text: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-50 dark:bg-purple-500/10', 
    ring: 'ring-purple-500/20',
    darkBg: 'bg-purple-500'
  },
  'Life Changing': { 
    border: 'border-emerald-200 dark:border-emerald-500/30', 
    text: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
    ring: 'ring-emerald-500/20',
    darkBg: 'bg-emerald-500'
  },
  'Emotional': { 
    border: 'border-rose-200 dark:border-rose-500/30', 
    text: 'text-rose-600 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-500/10', 
    ring: 'ring-rose-500/20',
    darkBg: 'bg-rose-500'
  },
  'Functional': { 
    border: 'border-blue-200 dark:border-blue-500/30', 
    text: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-500/10', 
    ring: 'ring-blue-500/20',
    darkBg: 'bg-blue-500'
  }
};

export const ValuePyramid: React.FC<ValuePyramidProps> = ({ avatars, onAvatarClick }) => {
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);

  const elementToAvatarsMap = React.useMemo(() => {
    const map: Record<string, Avatar[]> = {};
    avatars.forEach(avatar => {
      avatar.elementsOfValue?.forEach(val => {
        const element = ELEMENTS_OF_VALUE.find(e => e.name.toLowerCase() === val.element.toLowerCase());
        if (element) {
          if (!map[element.id]) map[element.id] = [];
          map[element.id].push(avatar);
        }
      });
    });
    return map;
  }, [avatars]);

  const selectedElement = React.useMemo(() => 
    ELEMENTS_OF_VALUE.find(e => e.id === selectedElementId),
    [selectedElementId]
  );

  return (
    <div className="space-y-24">
      <div className="text-center space-y-5 animate-matrix">
        <h3 className="text-[var(--text-xl)] sm:text-[var(--text-xl)] font-display font-semibold tracking-tight text-[var(--color-text-primary)]">Value Architecture</h3>
        <p className="text-[var(--text-lg)] text-[var(--color-text-secondary)] max-w-[640px] mx-auto font-medium leading-relaxed opacity-80">
          A multi-layered hierarchy of psychological drivers identified within your market segments. 
        </p>
      </div>

      <div className="relative max-w-[1200px] mx-auto space-y-16 lg:space-y-0 lg:flex lg:flex-col-reverse">
        {(Object.entries(PYRAMID_STRUCTURE) as [ValueCategory, string[]][]).map(([category, elementIds], catIdx) => {
          const colors = CategoryColors[category];
          
          return (
            <div key={category} className="relative group/category lg:-mt-12 first:mt-0 transition-transform duration-700 hover:z-20">
              <div className={cn(
                "rounded-[var(--radius-full)] border-[var(--color-border-secondary)] p-12 bg-[var(--color-card-bg)] backdrop-blur-2xl shadow-xl transition-all duration-700 hover:shadow-2xl hover:scale-[1.01]",
                category === 'Functional' && "lg:rounded-b-[40px] z-[1]",
                category === 'Emotional' && "lg:scale-[0.95] z-[2]",
                category === 'Life Changing' && "lg:scale-[0.9] z-[3]",
                category === 'Social Impact' && "lg:scale-[0.85] z-[4]",
                colors.border
              )}>
                <div className="flex items-center justify-between mb-12">
                   <div className="flex items-center gap-5">
                      <div className={cn("w-2 h-10 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)]", colors.darkBg)} />
                      <div className="flex flex-col">
                        <h4 className={cn("text-[var(--text-lg)] font-semibold uppercase tracking-[0.4em] leading-none", colors.text)}>
                            {category}
                        </h4>
                        {category === 'Functional' && (
                            <span className="text-[var(--text-xs)] font-mono font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.2em] mt-1 opacity-50">Foundation Layer</span>
                        )}
                      </div>
                   </div>
                   <div className={cn("px-5 py-2 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] border shadow-sm", colors.border, colors.bg, colors.text)}>
                      {elementIds.length} Pillars
                   </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {elementIds.map(id => {
                    const element = ELEMENTS_OF_VALUE.find(e => e.id === id);
                    const relatedAvatars = elementToAvatarsMap[id] || [];
                    const isHighlighted = relatedAvatars.length > 0;
                    const isSelected = selectedElementId === id;
                    const Icon = IconMap[element?.icon || 'Info'] || Info;

                    return (
                      <motion.button
                        key={id}
                        whileHover={{ y: -6, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedElementId(id)}
                        className={cn(
                          "relative flex flex-col items-center justify-center p-6 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] transition-all duration-500 min-h-[170px] group/item overflow-hidden",
                          isHighlighted 
                            ? cn("bg-[var(--color-card-bg)] shadow-[0_20px_50px_rgba(0,0,0,0.1)]", colors.border) 
                            : "bg-[var(--color-slate-elevated)]/30 border-[var(--color-border-default)] opacity-40 hover:opacity-100 hover:bg-[var(--color-card-bg)] hover:border-[var(--color-text-placeholder)] grayscale hover:grayscale-0",
                          isSelected && "ring-4 ring-[#0A84FF] border-[#0A84FF] z-30"
                        )}
                      >
                        {isHighlighted && (
                            <div className={cn("absolute inset-x-0 bottom-0 h-1", colors.darkBg)} />
                        )}
                        <div className={cn(
                          "w-14 h-14 rounded-[var(--radius-md)] flex items-center justify-center mb-5 transition-all duration-500 group-hover/item:scale-110 shadow-sm",
                          isHighlighted ? cn(colors.bg, colors.text) : "bg-[var(--color-slate-elevated)] text-[var(--color-text-secondary)] opacity-40"
                        )}>
                          <Icon size={28} strokeWidth={1.5} />
                        </div>
                        <span className={cn(
                          "text-[var(--text-base)] font-bold text-center leading-tight transition-colors px-2",
                          isHighlighted ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
                        )}>
                          {element?.name}
                        </span>
                        
                        {isHighlighted && (
                          <div className="absolute top-3 right-3 w-7 h-7 bg-[#0A84FF] text-white text-[var(--text-sm)] font-semibold rounded-full flex items-center justify-center shadow-lg border-[var(--color-border-secondary)] border-[var(--color-card-bg)] transition-transform group-hover/item:scale-110">
                            {relatedAvatars.length}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Floating Detail Panel - Adaptive positioning */}
        <AnimatePresence>
          {selectedElementId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed right-10 bottom-10 w-[360px] bg-[var(--color-card-bg)] shadow-[0_40px_100px_rgba(0,0,0,0.2)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] p-4 z-[100] preserve-3d"
            >
              <div className="p-6 space-y-8">
                <div className="flex items-center justify-between">
                   <div className="space-y-1">
                      <h4 className="text-[var(--text-lg)] font-display font-semibold tracking-tight text-[var(--color-text-primary)]">{selectedElement?.name}</h4>
                      <span className={cn("text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] font-mono", CategoryColors[selectedElement!.category].text)}>
                        {selectedElement?.category}
                      </span>
                   </div>
                   <button 
                     onClick={() => setSelectedElementId(null)}
                     className="w-10 h-10 flex items-center justify-center bg-[var(--color-slate-elevated)] rounded-full hover:bg-rose-500 hover:text-white transition-all text-[var(--color-text-secondary)]"
                   >
                     <X size={18} />
                   </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-[var(--color-slate-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border-default)]">
                    <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-medium leading-relaxed leading-[1.6]">
                        This element represents a core psychological node that triggers specific brand loyalties within this category.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 px-2">
                        <Users size={14} className="text-[#0A84FF]" />
                        <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.3em]">Identified Avatars</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {(elementToAvatarsMap[selectedElementId] || []).map(avatar => (
                        <button
                          key={avatar.id}
                          onClick={() => {
                            onAvatarClick(avatar);
                            setSelectedElementId(null);
                          }}
                          className="w-full flex items-center justify-between p-5 bg-[var(--color-slate-elevated)] hover:bg-[#0A84FF] hover:text-white rounded-[var(--radius-md)] border border-transparent transition-all group group-hover:scale-[1.02]"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                             <span className="text-[var(--text-base)] font-bold tracking-tight">{avatar.name}</span>
                             <span className="text-[var(--text-xs)] uppercase font-semibold tracking-[0.06em] opacity-60 group-hover:opacity-100">{avatar.category}</span>
                          </div>
                          <ChevronRight size={18} className="opacity-40 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </button>
                      ))}
                      {(elementToAvatarsMap[selectedElementId] || []).length === 0 && (
                        <div className="text-center py-12 bg-[var(--color-slate-elevated)]/50 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] border-dashed border-[var(--color-border-default)]">
                           <p className="text-[var(--text-sm)] font-bold text-[var(--color-text-secondary)] opacity-40">No segments identified.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-[#1D1D1F] rounded-[var(--radius-full)] p-16 text-white relative overflow-hidden shadow-2xl border border-white/5">
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#0A84FF]/20 blur-[160px] -mr-[400px] -mt-[400px] rounded-full opacity-60" />
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-10">
                <div className="inline-flex items-center gap-3 px-5 py-2 bg-[#0A84FF] rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] shadow-lg shadow-[#0A84FF]/30">
                  <Activity size={18} /> Strategic Vector
                </div>
                <h4 className="text-[var(--text-xl)] font-display font-semibold tracking-tight leading-[0.9]">The Value Threshold</h4>
                <div className="space-y-8">
                  <p className="text-[var(--text-lg)] text-white/80 font-medium leading-relaxed">
                    Transaction-based competition often clusters in the **Functional** layer. True market dominance occurs when you satisfy **Emotional** and **Life Changing** drivers.
                  </p>
                  <p className="text-[var(--text-lg)] text-white/80 font-medium leading-relaxed">
                     High concentrations in upper categories indicate maximum segment loyalty and resilient brand pricing power.
                  </p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
               {[
                 { label: 'Intensity Index', value: (avatars.reduce((acc, a) => acc + (a.elementsOfValue?.length || 0), 0) / avatars.length || 0).toFixed(1), icon: Activity, color: 'text-white' },
                 { label: 'Dominant Mode', value: 'Emotional', icon: Heart, color: 'text-rose-400' },
                 { label: 'Pillar Density', value: Object.keys(elementToAvatarsMap).length, icon: Layers, color: 'text-white' },
                 { label: 'Market Resilience', value: 'High Fidelity', icon: ShieldCheck, color: 'text-emerald-400' }
               ].map((item, i) => (
                 <div key={i} className="bg-white/5 border border-white/10 rounded-[var(--radius-md)] p-10 backdrop-blur-md flex flex-col items-center text-center group hover:bg-white/10 transition-all">
                    <item.icon size={24} className={cn("mb-5 opacity-40 group-hover:opacity-100 transition-opacity", item.color)} />
                    <div className="text-[var(--text-xs)] text-white/30 uppercase font-semibold tracking-[0.3em] mb-3">{item.label}</div>
                    <div className={cn("text-[var(--text-xl)] font-display font-semibold tracking-tight", item.color)}>{item.value}</div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
