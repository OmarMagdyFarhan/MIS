import React from 'react';
import { ReturningUserScreen } from '../components/ReturningUserScreen';
import { TransitionWrapper } from '../components/TransitionWrapper';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';
import { useToastActions, useToasts } from '../stores/uiStore';
import {
  useCompanies,
  useNeedsOfferUpdate,
  useCompanyActions,
} from '../stores/companyStore';
import { useOffers, useProgress, useOfferActions } from '../stores/offerStore';

interface Props {
  onSelectCompany: (id: string) => void;
  onEditCompany: (id: string, phase: 'company' | 'offer' | 'avatar') => void;
  onDeleteCompany: (id: string) => void;
  onAddNewCompany: () => void;
}

export function ReturningView({
  onSelectCompany,
  onEditCompany,
  onDeleteCompany,
  onAddNewCompany,
}: Props) {
  const companies = useCompanies();
  const needsOfferUpdate = useNeedsOfferUpdate();
  const { setCompanies, setNeedsOfferUpdate } = useCompanyActions();
  const offers = useOffers();
  const progress = useProgress();
  const { setOffers, setProgress } = useOfferActions();
  const { showSuccess: showSuccessToastMsg } = useToastActions();
  const { dismissSuccess } = useToasts();

  const handleDataImported = async () => {
    const [savedCompanies, savedOffers, savedProgress] = await Promise.all([
      StorageManager.load(STORAGE_KEYS.COMPANIES, []),
      StorageManager.load(STORAGE_KEYS.OFFERS, {}),
      StorageManager.load(STORAGE_KEYS.PROGRESS, {}),
    ]);
    setCompanies(savedCompanies);
    setOffers(savedOffers);
    setProgress(savedProgress);
    setNeedsOfferUpdate(await StorageManager.load(STORAGE_KEYS.NEEDS_OFFER_UPDATE, {}));
    showSuccessToastMsg('Data synced.');
    setTimeout(() => dismissSuccess(), 3500);
  };

  return (
    <TransitionWrapper id="returning">
      <ReturningUserScreen
        companies={companies}
        companyProgress={progress}
        needsOfferUpdate={needsOfferUpdate}
        offers={offers}
        onSelectCompany={onSelectCompany}
        onEditCompany={onEditCompany}
        onDeleteCompany={onDeleteCompany}
        onAddNewCompany={onAddNewCompany}
        onDataImported={handleDataImported}
      />
    </TransitionWrapper>
  );
}
