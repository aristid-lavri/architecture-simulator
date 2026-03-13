import { create } from 'zustand';
import { TOUR_STEPS } from '@/components/onboarding/steps';

interface OnboardingState {
  hasCompletedTour: boolean;
  currentStepIndex: number;
  isActive: boolean;

  // Actions
  startTour: () => void;
  advanceStep: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  hasCompletedTour: false,
  currentStepIndex: 0,
  isActive: false,

  startTour: () => set({ isActive: true, currentStepIndex: 0 }),

  advanceStep: () => {
    const { currentStepIndex } = get();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      get().completeTour();
    } else {
      set({ currentStepIndex: nextIndex });
    }
  },

  completeTour: () =>
    set({
      hasCompletedTour: true,
      isActive: false,
      currentStepIndex: 0,
    }),

  resetTour: () =>
    set({
      hasCompletedTour: false,
      isActive: true,
      currentStepIndex: 0,
    }),
}));
