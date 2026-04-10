import { create } from 'zustand';

export interface MigrationStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  details?: string;
  error?: string;
}

export interface MigrationResult {
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  steps: MigrationStep[];
  errors: string[];
  summary?: string;
  migrationId?: string;
}

interface MigrationStore {
  isMigrating: boolean;
  setIsMigrating: (value: boolean) => void;

  result: MigrationResult | null;
  setResult: (result: MigrationResult | null) => void;

  logs: string[];
  addLog: (message: string) => void;
  clearLogs: () => void;

  sourceProjectId: string;
  setSourceProjectId: (id: string) => void;

  sourceApiKey: string;
  setSourceApiKey: (key: string) => void;

  targetProjectId: string;
  setTargetProjectId: (id: string) => void;

  targetApiKey: string;
  setTargetApiKey: (key: string) => void;

  includeUsers: boolean;
  setIncludeUsers: (value: boolean) => void;

  includeStorage: boolean;
  setIncludeStorage: (value: boolean) => void;

  includeFunctions: boolean;
  setIncludeFunctions: (value: boolean) => void;

  reset: () => void;
}

export const useMigrationStore = create<MigrationStore>((set) => ({
  isMigrating: false,
  setIsMigrating: (value) => set({ isMigrating: value }),

  result: null,
  setResult: (result) => set({ result }),

  logs: [],
  addLog: (message) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    })),
  clearLogs: () => set({ logs: [] }),

  sourceProjectId: '',
  setSourceProjectId: (id) => set({ sourceProjectId: id }),

  sourceApiKey: '',
  setSourceApiKey: (key) => set({ sourceApiKey: key }),

  targetProjectId: '',
  setTargetProjectId: (id) => set({ targetProjectId: id }),

  targetApiKey: '',
  setTargetApiKey: (key) => set({ targetApiKey: key }),

  includeUsers: true,
  setIncludeUsers: (value) => set({ includeUsers: value }),

  includeStorage: true,
  setIncludeStorage: (value) => set({ includeStorage: value }),

  includeFunctions: true,
  setIncludeFunctions: (value) => set({ includeFunctions: value }),

  reset: () =>
    set({
      isMigrating: false,
      result: null,
      logs: [],
      sourceProjectId: '',
      sourceApiKey: '',
      targetProjectId: '',
      targetApiKey: '',
      includeUsers: true,
      includeStorage: true,
      includeFunctions: true,
    }),
}));
