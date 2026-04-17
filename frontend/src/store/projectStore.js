// src/store/projectStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Static project definitions — tower IDs are resolved from API at selection time
export const PROJECTS = [
  {
    code:   'BH1',
    name:   'Burooj Heights',
    plan:   '18 Month Plan',
    months: 18,
    color:  '#0098B4',
    desc:   'Launched January 2024',
  },
  {
    code:   'BH2',
    name:   'Burooj Heights 2',
    plan:   '3 Year Plan',
    months: 36,
    color:  '#4f46e5',
    desc:   '36-Month Installment Plan',
  },
  {
    code:   'BH3',
    name:   'Burooj Heights 3',
    plan:   '30 Month Plan',
    months: 30,
    color:  '#d97706',
    desc:   '30-Month Installment Plan',
  },
];

export const useProjectStore = create(
  persist(
    (set) => ({
      // project: { id, code, name, plan, months, color, desc }
      // id is the UUID from the towers table, resolved at selection time
      project: null,
      setProject: (p) => set({ project: p }),
      clearProject: () => set({ project: null }),
    }),
    {
      name: 'burooj-project',
      partialize: (state) => ({ project: state.project }),
    }
  )
);
