import { describe, it, expect, beforeEach } from 'vitest';
import { useSynthesisStore } from '../stores/synthesisStore';

describe('synthesisStore', () => {
  beforeEach(() => {
    useSynthesisStore.setState({
      isSynthesizing: false,
      synthesisReport: null,
      synthesisStage: '',
      _abortController: null,
      _lastRequestTimestamp: 0,
    });
  });

  it('beginRequest sets reactive state and returns a usable handle', () => {
    const handle = useSynthesisStore.getState().beginRequest('Identity');
    const s = useSynthesisStore.getState();
    expect(s.isSynthesizing).toBe(true);
    expect(s.synthesisStage).toBe('Identity');
    expect(s.synthesisReport).toBeNull();
    expect(handle.signal.aborted).toBe(false);
    expect(handle.isLatest()).toBe(true);
  });

  it('a new beginRequest aborts the previous and invalidates its handle', () => {
    const first = useSynthesisStore.getState().beginRequest('Identity');
    const second = useSynthesisStore.getState().beginRequest('Strategy');
    expect(first.signal.aborted).toBe(true);
    expect(first.isLatest()).toBe(false);
    expect(second.isLatest()).toBe(true);
    expect(useSynthesisStore.getState().synthesisStage).toBe('Strategy');
  });

  it('cancelCurrent aborts without touching reactive state', () => {
    const handle = useSynthesisStore.getState().beginRequest('Identity');
    useSynthesisStore.getState().cancelCurrent();
    expect(handle.signal.aborted).toBe(true);
    expect(useSynthesisStore.getState().isSynthesizing).toBe(true);
  });

  it('reset clears report and stops synthesizing', () => {
    useSynthesisStore.getState().beginRequest('Identity');
    useSynthesisStore.getState().setSynthesisReport({
      strengths: [],
      weaknesses: [],
      recommendations: [],
      score: 0,
    } as any);
    useSynthesisStore.getState().reset();
    const s = useSynthesisStore.getState();
    expect(s.isSynthesizing).toBe(false);
    expect(s.synthesisReport).toBeNull();
  });
});
