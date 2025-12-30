import { create } from 'zustand';

export interface DebugLog {
  id: string;
  timestamp: number;
  type: 'writer' | 'expert' | 'moderator' | 'system' | 'summary' | 'outline';
  agentName: string;
  request: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    tools?: any[];
  };
  response: {
    content: string;
    thinking?: string;
    toolCalls?: any[];
  };
  cost?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

interface DebugState {
  logs: DebugLog[];
  addLog: (log: Omit<DebugLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  logs: [],
  addLog: (log) => set((state) => ({
    logs: [{
      ...log,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    }, ...state.logs]
  })),
  clearLogs: () => set({ logs: [] })
}));
