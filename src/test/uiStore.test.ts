import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../stores/uiStore';

const initial = useUIStore.getState();

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      ...initial,
      isHubOpen: false,
      showFormulaModal: false,
      showCompanyModal: false,
      showConflictModal: false,
      pendingSaveType: null,
      successToast: null,
      errorToast: null,
    });
  });

  it('dark class is always on <html>', () => {
    // The app is always in dark mode
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('opens and closes the intelligence hub', () => {
    const { openHub, closeHub } = useUIStore.getState();
    openHub();
    expect(useUIStore.getState().isHubOpen).toBe(true);
    closeHub();
    expect(useUIStore.getState().isHubOpen).toBe(false);
  });

  it('tracks conflict modal type', () => {
    const { openConflictModal, closeConflictModal } = useUIStore.getState();
    openConflictModal('offer');
    expect(useUIStore.getState().showConflictModal).toBe(true);
    expect(useUIStore.getState().pendingSaveType).toBe('offer');
    closeConflictModal();
    expect(useUIStore.getState().showConflictModal).toBe(false);
  });

  it('shows and dismisses toasts independently', () => {
    const { showSuccess, showError, dismissSuccess, dismissError } = useUIStore.getState();
    showSuccess('saved');
    showError('boom');
    expect(useUIStore.getState().successToast).toBe('saved');
    expect(useUIStore.getState().errorToast).toBe('boom');
    dismissSuccess();
    expect(useUIStore.getState().successToast).toBeNull();
    expect(useUIStore.getState().errorToast).toBe('boom');
    dismissError();
    expect(useUIStore.getState().errorToast).toBeNull();
  });
});
