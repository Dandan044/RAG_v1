import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { DiscussionSession, DiscussionSettings, Expert, DiscussionMessage, NovelSession, NovelDraft, ExpertCritique, ModeratorSummary, WorkflowPhase } from '@/types';
import { generateExperts, generateExpertResponse, generateConclusion, generateExpertSuggestions, generateNovelSegment, generateExpertCritique, generateCritiqueSummary, rewriteNovel, summarizeStory, generateWorldview, generateOutlineContribution, generateOutlineSummary } from '@/api/deepseek';
import { analyzeCharacters, analyzeTasks } from '@/api/analyzers';
import { memoryStore } from '@/lib/vectorStore';

interface DiscussionState {
  session: DiscussionSession | null;
  novelSession: NovelSession | null; // New Novel Session
  isLoading: boolean;
  isGenerating: boolean; 
  isGeneratingConclusion: boolean;
  currentSpeakerId: string | null;
  error: string | null;
  speed: number; 
  
  // Existing Actions
  initSession: (topic: string, settings: DiscussionSettings) => Promise<void>;
  startDiscussion: () => void;
  pauseDiscussion: () => void;
  resumeDiscussion: () => void;
  stopDiscussion: () => void;
  setSpeed: (speed: number) => void;
  generateSessionConclusion: () => Promise<void>;
  processNextTurn: () => Promise<void>;

  // New Novel Actions
  initNovelSession: (requirements: string, worldview: string, experts: Expert[], maxRounds: number, enableThinking: boolean) => void;
  getExpertSuggestions: (requirements: string) => Promise<Expert[]>;
  generateWorldview: (requirements: string) => Promise<string>;
  startNovelWorkflow: () => void;
  stopNovel: () => void;
  processNovelCycle: () => Promise<void>;
  abortController: AbortController | null;
}

export const useDiscussionStore = create<DiscussionState>((set, get) => ({
  session: null,
  novelSession: null,
  isLoading: false,
  isGenerating: false,
  isGeneratingConclusion: false,
  currentSpeakerId: null,
  error: null,
  speed: 2000, 
  abortController: null,

  // ... (Existing initSession, startDiscussion, etc. - kept as is for compatibility, but omitted for brevity if I could, but I must keep file valid)
  initSession: async (topic, settings) => {
    set({ isLoading: true, error: null, currentSpeakerId: null });
    try {
      const experts = await generateExperts(topic, settings.expertCount);
      
      const newSession: DiscussionSession = {
        id: uuidv4(),
        topic,
        experts,
        messages: [],
        currentRound: 1,
        maxRounds: settings.maxRounds,
        enableThinking: settings.enableThinking,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      set({ session: newSession, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  startDiscussion: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, status: 'active' } });
    get().processNextTurn();
  },

  pauseDiscussion: () => {
    const { session } = get();
    if (session?.status === 'active') {
      set({ session: { ...session, status: 'paused' } });
    }
  },

  resumeDiscussion: () => {
    const { session } = get();
    if (session?.status === 'paused') {
      set({ session: { ...session, status: 'active' } });
      get().processNextTurn();
    }
  },

  stopDiscussion: () => {
    const { session } = get();
    if (session) {
      set({ session: { ...session, status: 'completed' }, currentSpeakerId: null });
    }
  },

  setSpeed: (speed) => set({ speed }),

  generateSessionConclusion: async () => {
    const { session, isGeneratingConclusion } = get();
    if (!session || isGeneratingConclusion) return;

    set({ isGeneratingConclusion: true });

    try {
      set(state => ({
        session: state.session ? { ...state.session, conclusion: '' } : null
      }));

      const finalConclusion = await generateConclusion(
        session.topic,
        session.messages,
        session.experts,
        (chunk) => {
          set(state => ({
            session: state.session ? {
              ...state.session,
              conclusion: (state.session.conclusion || '') + chunk
            } : null
          }));
        }
      );

      set(state => ({
        session: state.session ? { ...state.session, conclusion: finalConclusion } : null,
        isGeneratingConclusion: false
      }));

    } catch (error) {
      console.error('Error generating conclusion:', error);
      set({ error: (error as Error).message, isGeneratingConclusion: false });
    }
  },

  processNextTurn: async () => {
    const { session, isGenerating, speed } = get();
    if (!session || session.status !== 'active' || isGenerating) return;
    
    // ... (Existing logic logic kept for fallback)
    if (session.currentRound > session.maxRounds) {
      set({ session: { ...session, status: 'completed' }, currentSpeakerId: null });
      return;
    }

    const totalMessages = session.messages.length;
    const expertIndex = totalMessages % session.experts.length;
    const currentExpert = session.experts[expertIndex];

    set({ isGenerating: true, currentSpeakerId: currentExpert.id });

    try {
      let currentRound = session.currentRound;
      if (totalMessages > 0 && totalMessages % session.experts.length === 0) {
        currentRound += 1;
        set({ session: { ...session, currentRound } });
        
        if (currentRound > session.maxRounds) {
          set({ session: { ...session, status: 'completed' }, isGenerating: false, currentSpeakerId: null });
          return;
        }
      }

      const newMessageId = uuidv4();
      const newMessage: DiscussionMessage = {
        id: newMessageId,
        expertId: currentExpert.id,
        content: '',
        timestamp: Date.now(),
        round: currentRound
      };

      set(state => ({
        session: state.session ? {
          ...state.session,
          messages: [...state.session.messages, newMessage],
          updatedAt: new Date().toISOString()
        } : null
      }));

      const result = await generateExpertResponse(
        session.topic,
        currentExpert,
        session.messages,
        session.experts,
        session.enableThinking,
        (chunk, type) => {
          set(state => {
            if (!state.session) return {};
            const messages = state.session.messages.map(msg => 
              msg.id === newMessageId 
                ? { 
                    ...msg, 
                    content: type === 'content' ? msg.content + chunk : msg.content,
                    thinking: type === 'thinking' ? (msg.thinking || '') + chunk : msg.thinking
                  }
                : msg
            );
            return {
              session: { ...state.session, messages }
            };
          });
        }
      );

      set(state => {
         if (!state.session) return {};
         const messages = state.session.messages.map(msg => 
           msg.id === newMessageId 
             ? { ...msg, content: result.content, thinking: result.thinking }
             : msg
         );
         return {
           session: { ...state.session, messages }
         };
      });

      set({ isGenerating: false, currentSpeakerId: currentExpert.id });

      if (get().session?.status === 'active') {
        setTimeout(() => {
          get().processNextTurn();
        }, speed);
      }

    } catch (error) {
      console.error('Error in processNextTurn:', error);
      set({ error: (error as Error).message, isGenerating: false, currentSpeakerId: null });
      set(state => ({
        session: state.session ? { ...state.session, status: 'paused' } : null
      }));
    }
  },

  // --- Novel Workflow Implementation ---

  initNovelSession: (requirements, worldview, experts, maxRounds, enableThinking) => {
    // Clear previous memory store for a fresh start
    memoryStore.clear();

    // Store worldview in memory immediately
    if (worldview) {
        memoryStore.addDocument(worldview, { type: 'worldview', round: 0 });
    }

    // Check if we need a moderator (expert count > 2)
    let moderator: Expert | undefined;
    if (experts.length > 2) {
        moderator = {
            id: 'moderator-1',
            name: '主持人',
            field: '综合总结与协调',
            personality: '客观、理性、善于总结',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Moderator',
            initialStance: 'Neutral',
            color: '#8b5cf6' // Purple
        };
    }

    const newSession: NovelSession = {
      id: uuidv4(),
      requirements,
      worldview,
      outlines: [],
      outlineDiscussions: [],
      compiledStory: '',
      contextSummaries: [],
      summarizedLength: 0,
      experts,
      moderator,
      drafts: [],
      critiques: [],
      summaries: [],
      currentRound: 1,
      maxRounds,
      currentRevision: 0,
      maxRevisions: 1, // Default
      status: 'setup',
      enableThinking,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      characters: [],
      tasks: [],
    };
    set({ novelSession: newSession, error: null });
  },

  getExpertSuggestions: async (requirements) => {
    set({ isLoading: true });
    try {
      const experts = await generateExpertSuggestions(requirements);
      set({ isLoading: false });
      return experts;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return [];
    }
  },

  generateWorldview: async (requirements) => {
      set({ isLoading: true });
      try {
          const worldview = await generateWorldview(requirements);
          set({ isLoading: false });
          return worldview;
      } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
          return '';
      }
  },

  startNovelWorkflow: () => {
    const { novelSession } = get();
    if (!novelSession) return;

    // Reset abort controller
    const controller = new AbortController();
    set({ abortController: controller });

    // Check if we need an outline first (e.g., Round 1)
    const isOutlineRound = (novelSession.currentRound - 1) % 5 === 0;
    const currentOutlineRange = `第${novelSession.currentRound}-${novelSession.currentRound + 4}轮`;
    const hasOutline = novelSession.outlines.some(o => o.range === currentOutlineRange);

    let initialStatus: WorkflowPhase | 'outline_discussion' = 'drafting';
    if (isOutlineRound && !hasOutline) {
        initialStatus = 'outline_discussion';
    }

    set({ novelSession: { ...novelSession, status: initialStatus } });
    get().processNovelCycle();
  },

  stopNovel: () => {
    const { novelSession, abortController } = get();
    if (abortController) {
        abortController.abort();
    }
    if (novelSession) {
        // Do NOT set to completed to avoid navigation
        set({ 
            isGenerating: false, 
            currentSpeakerId: null,
            abortController: null
        });
    }
  },

  processNovelCycle: async () => {
    const { novelSession, isGenerating, abortController } = get();
    // Ensure we have a valid controller if we are processing
    let currentController = abortController;
    if (!currentController) {
        currentController = new AbortController();
        set({ abortController: currentController });
    }
    const signal = currentController.signal;

    if (!novelSession || isGenerating) return;

    // 0. Outline Phase Check (Auto-trigger every 5 rounds)
    const isOutlineRound = (novelSession.currentRound - 1) % 5 === 0;
    const currentOutlineRange = `第${novelSession.currentRound}-${novelSession.currentRound + 4}轮`;
    const hasOutline = novelSession.outlines.some(o => o.range === currentOutlineRange);

    if (isOutlineRound && !hasOutline && novelSession.status !== 'outline_discussion') {
        set({ 
            novelSession: { ...novelSession, status: 'outline_discussion' },
            isGenerating: false 
        });
        setTimeout(() => get().processNovelCycle(), 0);
        return;
    }

    if (novelSession.status === 'outline_discussion') {
        set({ isGenerating: true });
        try {
            const { experts, worldview, outlines, currentRound, requirements, enableThinking } = novelSession;
            const historyOutline = outlines.map(o => `【${o.range}】:\n${o.content}`).join('\n\n');
            
            let discussionLog = '';
            
            // 2 Rounds of Expert Discussion
            for (let r = 0; r < 2; r++) {
                for (const expert of experts) {
                    set({ currentSpeakerId: expert.id }); // Highlight speaker
                    
                    // Create placeholder message
                    const msgId = uuidv4();
                    const newMessage: DiscussionMessage = {
                        id: msgId,
                        expertId: expert.id,
                        content: '',
                        timestamp: Date.now(),
                        round: currentRound
                    };
                    
                    set(state => ({
                        novelSession: state.novelSession ? {
                            ...state.novelSession,
                            outlineDiscussions: [...state.novelSession.outlineDiscussions, newMessage]
                        } : null
                    }));

                    const result = await generateOutlineContribution(
                        expert,
                        worldview,
                        requirements,
                        historyOutline,
                        currentRound,
                        discussionLog, // Pass previous opinions
                        enableThinking,
                        (chunk, type) => {
                             if (type === 'content') {
                                 set(state => {
                                     if (!state.novelSession) return {};
                                     const msgs = state.novelSession.outlineDiscussions.map(m => 
                                         m.id === msgId ? { ...m, content: m.content + chunk } : m
                                     );
                                     return { novelSession: { ...state.novelSession, outlineDiscussions: msgs } };
                                 });
                             }
                        },
                        signal
                    );
                    
                    discussionLog += `${expert.name} (${expert.field}): ${result.content}\n\n`;
                    
                    // Update final content
                    set(state => {
                        if (!state.novelSession) return {};
                        const msgs = state.novelSession.outlineDiscussions.map(m => 
                            m.id === msgId ? { ...m, content: result.content, thinking: result.thinking } : m
                        );
                        return { novelSession: { ...state.novelSession, outlineDiscussions: msgs } };
                    });

                    // Add a small delay for UI visualization
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            set({ currentSpeakerId: null });

            // Generate Summary
            const summary = await generateOutlineSummary(discussionLog, currentRound, undefined, signal);
            
            // Store Outline
            const newOutline = {
                range: currentOutlineRange,
                content: summary
            };

            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    outlines: [...state.novelSession.outlines, newOutline],
                    status: 'drafting' // Done, move to drafting
                } : null,
                isGenerating: false
            }));

            // Store in Vector DB
            await memoryStore.addDocument(summary, { type: 'outline', round: currentRound });

            // Proceed
            get().processNovelCycle();

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Outline generation aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Outline generation error:', error);
            set({ error: (error as Error).message, isGenerating: false });
        }
    }

    // 1. Drafting Phase
    else if (novelSession.status === 'drafting') {
      set({ isGenerating: true });
      try {
        let fullContent = '';
        const segments: string[] = [];
        
        // Retrieve current outline for this round
        const currentOutlineRange = `第${Math.floor((novelSession.currentRound - 1) / 5) * 5 + 1}-${Math.floor((novelSession.currentRound - 1) / 5) * 5 + 5}轮`;
        const currentOutline = novelSession.outlines.find(o => o.range === currentOutlineRange)?.content || '';
        const outlineStage = (novelSession.currentRound - 1) % 5 + 1;

        // Create draft placeholder immediately
        const draftId = Date.now();
        const newDraft: NovelDraft = {
            round: novelSession.currentRound,
            version: novelSession.drafts.length + 1,
            content: '',
            segments: [],
            createdAt: draftId
        };

        set(state => ({
            novelSession: state.novelSession ? {
                ...state.novelSession,
                drafts: [...state.novelSession.drafts, newDraft]
            } : null
        }));
        
        // Determine segment count: Only 1st Round of 1st Cycle gets 3 segments. Others get 1.
        // "Round" in user terms = Revision Iteration? Or Cycle? 
        // User: "Author only writes 3 times in the first round of the first cycle"
        // Cycle = currentRound. Round = currentRevision (0-based in code, effectively 1st attempt).
        const segmentCount = (novelSession.currentRound === 1 && novelSession.currentRevision === 0) ? 3 : 1;

        // Consecutive requests
        for (let i = 0; i < segmentCount; i++) {
            let segmentContent = '';
            
            // Context Management Logic
            let contextForAI = novelSession.compiledStory || '';
            const unsummarizedText = novelSession.compiledStory.slice(novelSession.summarizedLength || 0);
            
            // Check if we need to archive some old text
            // If unsummarized text is too long (e.g. > 20000 chars ~ 13k tokens), summarize the oldest chunk
            const ARCHIVE_THRESHOLD = 20000;
            const CHUNK_SIZE = 10000;
            
            if (unsummarizedText.length > ARCHIVE_THRESHOLD) {
                // Take the first CHUNK_SIZE chars of the unsummarized text
                const chunkToSummarize = unsummarizedText.slice(0, CHUNK_SIZE);
                
                // Generate summary for this chunk
                // We use summarizeStory API
                const chunkSummary = await summarizeStory(chunkToSummarize);
                
                // Store this summary
                const newContextSummaries = [...(novelSession.contextSummaries || []), chunkSummary];
                const newSummarizedLength = (novelSession.summarizedLength || 0) + CHUNK_SIZE;
                
                // Update session with new summary info
                set(state => ({
                    novelSession: state.novelSession ? {
                        ...state.novelSession,
                        contextSummaries: newContextSummaries,
                        summarizedLength: newSummarizedLength,
                        // Add to summaries list for Debug Dashboard visibility
                        summaries: [...state.novelSession.summaries, {
                            round: novelSession.currentRound,
                            content: `[系统自动归档摘要 - 第${newContextSummaries.length}部分]:\n${chunkSummary}`,
                            timestamp: Date.now()
                        }]
                    } : null
                }));
                
                // Re-calculate context for AI
                // It is: All Summaries + Remaining Unsummarized Text
                const remainingText = novelSession.compiledStory.slice(newSummarizedLength);
                contextForAI = newContextSummaries.map((s, idx) => `[前情提要 ${idx + 1}]: ${s}`).join('\n\n') + 
                               '\n\n[近期剧情]:\n' + remainingText;
            } else {
                 // Normal case: summaries + current unsummarized
                 if (novelSession.contextSummaries && novelSession.contextSummaries.length > 0) {
                     contextForAI = novelSession.contextSummaries.map((s, idx) => `[前情提要 ${idx + 1}]: ${s}`).join('\n\n') + 
                                    '\n\n[近期剧情]:\n' + unsummarizedText;
                 }
            }

            await generateNovelSegment(
                novelSession.requirements,
                contextForAI + '\n\n' + fullContent, // Add current drafting content
                i,
                novelSession.enableThinking,
                (chunk, type) => {
                   if (type === 'content') {
                       segmentContent += chunk;
                       // Update the LAST draft in the array
                       set(state => {
                           if (!state.novelSession) return {};
                           const drafts = [...state.novelSession.drafts];
                           const currentDraftIndex = drafts.length - 1;
                           drafts[currentDraftIndex] = {
                               ...drafts[currentDraftIndex],
                               content: drafts[currentDraftIndex].content + chunk
                           };
                           return { novelSession: { ...state.novelSession, drafts } };
                       });
                   }
                },
                novelSession.worldview, // Pass worldview
                currentOutline, // Pass outline
                outlineStage, // Pass outlineStage
                signal
            );
            
            fullContent += segmentContent + '\n\n'; 
            
            set(state => {
                if (!state.novelSession) return {};
                const drafts = [...state.novelSession.drafts];
                const currentDraftIndex = drafts.length - 1;
                // Add double newline to separate segments visually if not last segment
                if (i < segmentCount - 1) {
                     drafts[currentDraftIndex] = {
                        ...drafts[currentDraftIndex],
                        content: drafts[currentDraftIndex].content + '\n\n'
                    };
                }
                return { novelSession: { ...state.novelSession, drafts } };
            });

            segments.push(segmentContent);
        }

        // Finalize draft (update segments array)
        set(state => {
             if (!state.novelSession) return {};
             const drafts = [...state.novelSession.drafts];
             const currentDraftIndex = drafts.length - 1;
             drafts[currentDraftIndex] = {
                 ...drafts[currentDraftIndex],
                 segments: segments
             };
             return { 
                 novelSession: { 
                     ...state.novelSession, 
                     drafts,
                     status: 'critiquing'
                 },
                 isGenerating: false
             };
        });

        // Proceed to next phase
        get().processNovelCycle();

      } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('Drafting aborted');
            set({ isGenerating: false });
            return;
        }
        console.error('Drafting error:', error);
        set({ error: (error as Error).message, isGenerating: false });
      }
    }

    // 2. Critiquing Phase (Parallel)
    else if (novelSession.status === 'critiquing') {
        set({ isGenerating: true });
        try {
            const currentDraft = novelSession.drafts[novelSession.drafts.length - 1];
            
            // Retrieve current outline for this round
            const currentOutlineRange = `第${Math.floor((novelSession.currentRound - 1) / 5) * 5 + 1}-${Math.floor((novelSession.currentRound - 1) / 5) * 5 + 5}轮`;
            const currentOutline = novelSession.outlines.find(o => o.range === currentOutlineRange)?.content || '';
            const outlineStage = (novelSession.currentRound - 1) % 5 + 1;

            // Create placeholders for critiques
            const critiquePromises = novelSession.experts.map(async (expert) => {
                const critiqueId = uuidv4();
                
                // Add placeholder
                set(state => ({
                    novelSession: state.novelSession ? {
                        ...state.novelSession,
                        critiques: [...state.novelSession.critiques, {
                            id: critiqueId,
                            expertId: expert.id,
                            round: novelSession.currentRound,
                            content: '',
                            thinking: '',
                            timestamp: Date.now()
                        }]
                    } : null
                }));

                // Generate critique
                const result = await generateExpertCritique(
                    currentDraft.content,
                    expert,
                    novelSession.enableThinking,
                    (chunk, type) => {
                        set(state => ({
                            novelSession: state.novelSession ? {
                                ...state.novelSession,
                                critiques: state.novelSession.critiques.map(c => 
                                    c.id === critiqueId ? { 
                                        ...c, 
                                        content: type === 'content' ? c.content + chunk : c.content,
                                        thinking: type === 'thinking' ? (c.thinking || '') + chunk : c.thinking
                                    } : c
                                )
                            } : null
                        }));
                    },
                    novelSession.worldview, // Add this
                    currentOutline,
                    novelSession.currentRound,
                    outlineStage,
                    signal
                );
                return { expertName: expert.name, content: result.content };
            });

            await Promise.all(critiquePromises);

            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    status: 'summarizing'
                } : null,
                isGenerating: false
            }));

            // Proceed to next phase
            get().processNovelCycle();

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Critique aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Critique error:', error);
            set({ error: (error as Error).message, isGenerating: false });
        }
    }

    // 3. Summarizing Phase
    else if (novelSession.status === 'summarizing') {
        set({ isGenerating: true });
        try {
            const currentDraft = novelSession.drafts[novelSession.drafts.length - 1];
            const currentCritiques = novelSession.critiques.filter(c => c.round === novelSession.currentRound);
            const expertCritiques = currentCritiques.map(c => ({
                expertName: novelSession.experts.find(e => e.id === c.expertId)?.name || 'Unknown',
                content: c.content
            }));

            // Create placeholder
            const summaryId = Date.now();
            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    summaries: [...state.novelSession.summaries, {
                        round: novelSession.currentRound,
                        content: '',
                        timestamp: summaryId
                    }]
                } : null
            }));

            const summaryContent = await generateCritiqueSummary(
                currentDraft.content,
                expertCritiques,
                (chunk) => {
                    set(state => ({
                        novelSession: state.novelSession ? {
                            ...state.novelSession,
                            summaries: state.novelSession.summaries.map(s => 
                                s.round === novelSession.currentRound ? { ...s, content: s.content + chunk } : s
                            )
                        } : null
                    }));
                },
                signal
            );

            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    status: 'revising'
                } : null,
                isGenerating: false
            }));

             // Proceed to next phase
             get().processNovelCycle();

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Summary aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Summary error:', error);
            set({ error: (error as Error).message, isGenerating: false });
        }
    }

    // 4. Revising Phase
    else if (novelSession.status === 'revising') {
        set({ isGenerating: true });
        try {
            const currentDraft = novelSession.drafts[novelSession.drafts.length - 1];
            const currentSummary = novelSession.summaries.find(s => s.round === novelSession.currentRound);

            if (!currentSummary) throw new Error('Summary not found');

            // Create a NEW draft entry for the revision
            const revisionDraftId = Date.now();
            const newRevisionDraft: NovelDraft = {
                round: novelSession.currentRound,
                version: currentDraft.version + 1, // Increment version
                content: '',
                segments: [],
                createdAt: revisionDraftId
            };

            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    drafts: [...state.novelSession.drafts, newRevisionDraft]
                } : null
            }));

            const result = await rewriteNovel(
                currentDraft.content,
                currentSummary.content,
                novelSession.requirements,
                novelSession.enableThinking,
                (chunk, type) => {
                     if (type === 'content') {
                        set(state => {
                            if (!state.novelSession) return {};
                            const drafts = [...state.novelSession.drafts];
                            const currentDraftIndex = drafts.length - 1; // Update the NEW revision draft
                            drafts[currentDraftIndex] = {
                                ...drafts[currentDraftIndex],
                                content: drafts[currentDraftIndex].content + chunk
                            };
                            return { novelSession: { ...state.novelSession, drafts } };
                        });
                    }
                },
                signal
            );

            // REVISING COMPLETE. Now we have a finalized chunk for this round.
            const finalizedText = result.content;
            
            // 1. Store in Vector Memory
            await memoryStore.addDocument(finalizedText, {
                round: novelSession.currentRound,
                type: 'narrative'
            });

            // 1.5. Trigger Analyzers (Characters & Tasks)
            // Run in background, don't block the UI transition but update store when done
            const currentRoundForAnalyzer = novelSession.currentRound;
            const currentCharacters = novelSession.characters || [];
            const currentTasks = novelSession.tasks || [];
            
            // We use the same signal or a new one? Analyzer shouldn't be strictly aborted if revision is done, 
            // but let's stick to the controller for now.
            
            Promise.all([
                analyzeCharacters(finalizedText, currentCharacters, currentRoundForAnalyzer, signal),
                analyzeTasks(finalizedText, currentTasks, currentRoundForAnalyzer, signal)
            ]).then(([updatedChars, updatedTasks]) => {
                set(state => {
                    if (!state.novelSession) return {};
                    return {
                        novelSession: {
                            ...state.novelSession,
                            characters: updatedChars,
                            tasks: updatedTasks
                        }
                    };
                });
            }).catch(err => console.error("Analyzer error:", err));


            set(state => {
                if (!state.novelSession) return {};
                
                const currentRevision = state.novelSession.currentRevision + 1;
                const isRevisionComplete = currentRevision >= state.novelSession.maxRevisions;

                if (isRevisionComplete) {
                    // CYCLE COMPLETE -> Move to next Cycle (Drafting)
                    const nextRound = state.novelSession.currentRound + 1;
                    const nextStatus = 'drafting';

                    return {
                        novelSession: {
                            ...state.novelSession,
                            currentRound: nextRound,
                            status: nextStatus,
                            currentRevision: 0, // Reset revision count for new cycle
                            // Append to compiled story
                            compiledStory: (state.novelSession.compiledStory || '') + '\n\n' + finalizedText,
                        },
                        isGenerating: false
                    };
                } else {
                    // CYCLE NOT COMPLETE -> Go back to Critiquing for next revision round
                    return {
                        novelSession: {
                            ...state.novelSession,
                            currentRevision: currentRevision,
                            status: 'critiquing',
                            // Update the draft content for next critique round?
                            // The `drafts` array already has the revised content as the last entry.
                            // Critiquing phase picks up `drafts[last]`. So we are good.
                        },
                        isGenerating: false
                    };
                }
            });

            // If not completed, continue automatically
            const { novelSession: updatedSession } = get();
            if (updatedSession && (updatedSession.status === 'drafting' || updatedSession.status === 'critiquing')) {
                // IMPORTANT: Ensure we actually trigger the next cycle
                get().processNovelCycle();
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Revision aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Revision error:', error);
            set({ error: (error as Error).message, isGenerating: false });
        }
    }
  }

}));
