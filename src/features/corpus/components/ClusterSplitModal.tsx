import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Split } from 'lucide-react';
import type { Cluster, EvidenceMessage } from '../../../types/pipeline';
import { PIPELINE_THRESHOLDS } from '../../../constants/pipelineThresholds';

interface Props {
  open: boolean;
  cluster: Cluster | null;
  messages: EvidenceMessage[];
  onClose: () => void;
  onSplit: (messageIds: string[], newLabel: string) => void;
}

export const ClusterSplitModal: React.FC<Props> = ({
  open,
  cluster,
  messages,
  onClose,
  onSplit,
}) => {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = React.useState('');

  React.useEffect(() => {
    if (cluster) {
      setSelected(new Set());
      setNewLabel(`${cluster.label} (split)`);
    }
  }, [cluster?.id, open]);

  if (!cluster) return null;

  const clusterMessages = cluster.messageIds
    .map(id => messages.find(m => m.id === id))
    .filter((m): m is EvidenceMessage => !!m);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit =
    selected.size > 0 &&
    selected.size < cluster.messageIds.length &&
    newLabel.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[560px] max-h-[85vh] overflow-auto rounded-[var(--radius-md)] bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Split size={20} className="text-violet-600" />
                <h3 className="text-[var(--text-lg)] font-bold">Split cluster</h3>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-card-bg)]">
                <X size={18} />
              </button>
            </div>

            <p className="text-[var(--text-sm)] text-[#86868B]">
              Select quotes to move into a new cluster. Parent cluster keeps the rest.
              Minimum {PIPELINE_THRESHOLDS.MIN_MESSAGES_VALIDATED_CLUSTER} messages recommended
              per cluster before validation.
            </p>

            <div>
              <label className="text-[var(--text-xs)] font-semibold uppercase text-[#86868B]">New cluster name</label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="mt-2 w-full p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] text-[var(--text-base)]"
              />
            </div>

            <ul className="space-y-2 max-h-[320px] overflow-y-auto">
              {clusterMessages.map((m, i) => (
                <li key={m.id}>
                  <label className="flex gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] cursor-pointer hover:bg-[var(--color-card-bg)]/80">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="text-[var(--text-sm)]">
                      <span className="font-semibold text-[var(--text-xs)] text-[#86868B] block mb-1">
                        Quote #{i + 1}
                      </span>
                      {m.rawText.slice(0, 180)}
                      {m.rawText.length > 180 ? '…' : ''}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[var(--radius-sm)] text-[var(--text-sm)] font-semibold uppercase text-[#86868B]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => {
                  onSplit([...selected], newLabel.trim());
                  onClose();
                }}
                className="px-6 py-2 rounded-[var(--radius-sm)] bg-[#1D1D1F] text-white text-[var(--text-sm)] font-semibold uppercase disabled:opacity-40"
              >
                Split ({selected.size} quotes)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
