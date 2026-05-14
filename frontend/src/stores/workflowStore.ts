import { create } from "zustand";

type VisitStep = "register" | "accept" | "diagnosis" | "prescription" | "billing";

interface WorkflowState {
  currentVisitId: number | null;
  currentStep: VisitStep;
  setVisitId: (id: number) => void;
  setStep: (step: VisitStep) => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>()((set) => ({
  currentVisitId: null,
  currentStep: "register",

  setVisitId: (id) => set({ currentVisitId: id, currentStep: "register" }),

  setStep: (step) => set({ currentStep: step }),

  reset: () => set({ currentVisitId: null, currentStep: "register" }),
}));
