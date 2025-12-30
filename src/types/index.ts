export interface Expert {
  id: string;
  name: string;
  field: string;
  personality: string;
  avatar: string;
  initialStance: string;
  color: string;
}

export interface DiscussionMessage {
  id: string;
  expertId: string;
  content: string;
  thinking?: string; // Content from the thinking process
  timestamp: number;
  round: number;
}

export interface DiscussionSession {
  id: string;
  topic: string;
  experts: Expert[];
  messages: DiscussionMessage[];
  currentRound: number;
  maxRounds: number;
  status: 'pending' | 'active' | 'paused' | 'completed';
  enableThinking: boolean;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionSettings {
  topic: string;
  expertCount: number;
  maxRounds: number;
  enableThinking: boolean;
  discussionGoal: 'consensus' | 'exploration' | 'debate';
}

// New Types for Novel Workflow

export interface NovelDraft {
  round: number;
  version: number;
  content: string;
  segments: string[]; // Store the 3 segments if needed
  createdAt: number;
}

export interface ExpertCritique {
  id: string;
  expertId: string;
  round: number;
  content: string;
  thinking?: string;
  timestamp: number;
}

export interface ModeratorSummary {
  round: number;
  content: string;
  timestamp: number;
}

export type WorkflowPhase = 'setup' | 'drafting' | 'critiquing' | 'summarizing' | 'revising' | 'completed';

export interface Outline {
  range: string; // e.g. "第1-5章"
  content: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  status: string;
  location: string;
  relationships: string;
  tags: string[];
  lastUpdatedRound: number;
}

export interface StoryTask {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side';
  status: 'active' | 'completed' | 'failed';
  rewards: string;
  progress: string;
  lastUpdatedRound: number;
}

export interface NovelSession {
  id: string;
  requirements: string;
  worldview: string; // New: Worldview setting
  outlines: Outline[]; // New: List of outlines
  outlineDiscussions: DiscussionMessage[]; // New: Real-time discussion for outlines
  compiledStory: string;
  contextSummaries: string[];
  summarizedLength: number;
  experts: Expert[];
  moderator?: Expert;
  drafts: NovelDraft[];
  critiques: ExpertCritique[];
  summaries: ModeratorSummary[];
  currentRound: number; // This represents the "Cycle" (Chapter)
  maxRounds: number; // This represents Max Cycles
  currentRevision: number; // Track inner revision rounds
  maxRevisions: number; // Max revision rounds per cycle (default 1)
  status: WorkflowPhase | 'outline_discussion'; // New Status
  enableThinking: boolean;
  createdAt: string;
  updatedAt: string;
  characters: CharacterProfile[]; // New: Character records
  tasks: StoryTask[]; // New: Task records
}
