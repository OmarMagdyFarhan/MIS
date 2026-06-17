import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../stores/workflowStore';

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      currentView: 'welcome',
      stageStep: 1,
      avatarMethod: null,
    });
  });

  it('setCurrentView updates view only', () => {
    useWorkflowStore.getState().setCurrentView('stage2');
    expect(useWorkflowStore.getState().currentView).toBe('stage2');
    expect(useWorkflowStore.getState().stageStep).toBe(1);
  });

  it('setStageStep accepts value and updater fn', () => {
    useWorkflowStore.getState().setStageStep(3);
    expect(useWorkflowStore.getState().stageStep).toBe(3);
    useWorkflowStore.getState().setStageStep((p) => p + 1);
    expect(useWorkflowStore.getState().stageStep).toBe(4);
  });

  it('setAvatarMethod toggles selection', () => {
    useWorkflowStore.getState().setAvatarMethod('ai');
    expect(useWorkflowStore.getState().avatarMethod).toBe('ai');
    useWorkflowStore.getState().setAvatarMethod(null);
    expect(useWorkflowStore.getState().avatarMethod).toBeNull();
  });

  it('goTo updates view and step atomically', () => {
    useWorkflowStore.getState().goTo('stage3', 1);
    const s = useWorkflowStore.getState();
    expect(s.currentView).toBe('stage3');
    expect(s.stageStep).toBe(1);
  });

  it('goTo without step leaves step intact', () => {
    useWorkflowStore.setState({ stageStep: 6 });
    useWorkflowStore.getState().goTo('returning');
    const s = useWorkflowStore.getState();
    expect(s.currentView).toBe('returning');
    expect(s.stageStep).toBe(6);
  });
});
