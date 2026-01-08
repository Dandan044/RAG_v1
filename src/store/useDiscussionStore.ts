import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { DiscussionSession, DiscussionSettings, Expert, DiscussionMessage, NovelSession, NovelDraft, WorkflowPhase } from '@/types';
import { generateExperts, generateExpertResponse, generateConclusion, generateExpertSuggestions, generateNovelSegment, generateExpertCritique, generateCritiqueSummary, rewriteNovel, summarizeStory, generateWorldview, generateOutlineContribution, generateOutlineSummary, generateOptions } from '@/api/deepseek';
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
  submitOption: (choice: string) => void;
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
      archiveSessionId: (() => {
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      })(),
      currentOptions: [],
      choiceHistory: []
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

    // Check if we need an outline first
    const isFirstRound = novelSession.currentRound === 1;
    const hasAnyOutline = novelSession.outlines.length > 0;
    const shouldUpdate = novelSession.shouldUpdateOutline;

    let initialStatus: WorkflowPhase | 'outline_discussion' = 'drafting';
    if ((isFirstRound && !hasAnyOutline) || shouldUpdate) {
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

  submitOption: (choice: string) => {
    // Wrap in setTimeout to avoid updating state during render of parent components
    setTimeout(() => {
        set(state => {
            if (!state.novelSession) return {};
            
            // Prevent duplicate submissions if status already changed
            if (state.novelSession.status !== 'selecting_option') {
                return {};
            }

            const nextRound = state.novelSession.currentRound + 1;
            
            // Append choice to compiled story with styling
            const choiceText = `\n\n> **【抉择】 ${choice}**\n\n***\n\n`;

            return {
                novelSession: {
                    ...state.novelSession,
                    choiceHistory: [...state.novelSession.choiceHistory, { round: state.novelSession.currentRound, choice }],
                    currentRound: nextRound,
                    status: 'drafting',
                    currentRevision: 0,
                    currentOptions: [],
                    compiledStory: state.novelSession.compiledStory + choiceText
                }
            };
        });
        get().processNovelCycle();
    }, 0);
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

    // 0. Outline Phase Check
    // Trigger if: Round 1 (no outline) OR Voted to update
    const isFirstRound = novelSession.currentRound === 1;
    const hasAnyOutline = novelSession.outlines.length > 0;
    const shouldUpdate = novelSession.shouldUpdateOutline;
    
    // Define range for potential new outline
    const currentOutlineRange = `第${novelSession.currentRound}-${novelSession.currentRound + 4}轮`;

    if (((isFirstRound && !hasAnyOutline) || shouldUpdate) && novelSession.status !== 'outline_discussion') {
        set(state => ({ 
            novelSession: state.novelSession ? { 
                ...state.novelSession, 
                status: 'outline_discussion',
                shouldUpdateOutline: false // Reset flag
            } : null,
            isGenerating: false 
        }));
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
                // 1. Create placeholders for ALL experts in this round
                const messageIds: Record<string, string> = {}; // map expertId to messageId
                
                // Batch state update for placeholders
                set(state => {
                    if (!state.novelSession) return {};
                    const newMessages: DiscussionMessage[] = [];
                    
                    experts.forEach(expert => {
                        const msgId = uuidv4();
                        messageIds[expert.id] = msgId;
                        newMessages.push({
                            id: msgId,
                            expertId: expert.id,
                            content: '',
                            timestamp: Date.now(),
                            round: currentRound
                        });
                    });

                    return {
                        novelSession: {
                            ...state.novelSession,
                            outlineDiscussions: [...state.novelSession.outlineDiscussions, ...newMessages]
                        }
                    };
                });

                // 2. Parallel execution
                const roundResults = await Promise.all(experts.map(async (expert) => {
                    const msgId = messageIds[expert.id];
                    
                    const result = await generateOutlineContribution(
                        expert,
                        worldview,
                        requirements,
                        historyOutline,
                        currentRound,
                        discussionLog, // Pass logs from PREVIOUS rounds only
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
                    
                    // Update final content
                    set(state => {
                        if (!state.novelSession) return {};
                        const msgs = state.novelSession.outlineDiscussions.map(m => 
                            m.id === msgId ? { ...m, content: result.content, thinking: result.thinking } : m
                        );
                        return { novelSession: { ...state.novelSession, outlineDiscussions: msgs } };
                    });

                    return { expert, content: result.content };
                }));

                // 3. Update discussionLog for the next round
                roundResults.forEach(({ expert, content }) => {
                    discussionLog += `${expert.name} (${expert.field}): ${content}\n\n`;
                });

                // Add a small delay for UI visualization
                await new Promise(resolve => setTimeout(resolve, 1000));
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

        } catch (error) {
            const err = error as Error & { name?: string };
            if (err.name === 'AbortError') {
                console.log('Outline generation aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Outline generation error:', err);
            set({ error: err.message, isGenerating: false });
        }
    }

    // 1. Drafting Phase
    else if (novelSession.status === 'drafting') {
      set({ isGenerating: true });
      try {
        let fullContent = '';
        const segments: string[] = [];
        
        // Retrieve latest outline
        let currentOutline = '';
        let roundsInCurrentOutline = 1;

        if (novelSession.outlines.length > 0) {
            const lastOutline = novelSession.outlines[novelSession.outlines.length - 1];
            currentOutline = lastOutline.content;
            
            // Parse start round from range string (e.g. "第1-5轮")
            const match = lastOutline.range.match(/第(\d+)/);
            if (match && match[1]) {
                const startRound = parseInt(match[1]);
                roundsInCurrentOutline = novelSession.currentRound - startRound + 1;
            }
        }

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
        // User update: Always generate 1 segment per round now.
        const segmentCount = 1;

        // Retrieve user choice for this round (Choice made at end of previous round)
        const userChoiceObj = novelSession.choiceHistory.find(c => c.round === novelSession.currentRound - 1);
        const userChoice = userChoiceObj ? userChoiceObj.choice : undefined;

        // Retrieve protagonist profile
        const protagonist = novelSession.characters.find(c => c.isProtagonist);

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
                roundsInCurrentOutline, // Pass roundsInCurrentOutline
                userChoice, // Pass userChoice
                protagonist, // Pass protagonist profile
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

      } catch (error) {
        const err = error as Error & { name?: string };
        if (err.name === 'AbortError') {
            console.log('Drafting aborted');
            set({ isGenerating: false });
            return;
        }
        console.error('Drafting error:', err);
        set({ error: err.message, isGenerating: false });
      }
    }

    // 2. Critiquing Phase (Parallel)
    else if (novelSession.status === 'critiquing') {
        set({ isGenerating: true });
        try {
            const currentDraft = novelSession.drafts[novelSession.drafts.length - 1];
            
            // Retrieve latest outline
            let currentOutline = '';
            let roundsInCurrentOutline = 1;

            if (novelSession.outlines.length > 0) {
                const lastOutline = novelSession.outlines[novelSession.outlines.length - 1];
                currentOutline = lastOutline.content;
                
                // Parse start round from range string (e.g. "第1-5轮")
                const match = lastOutline.range.match(/第(\d+)/);
                if (match && match[1]) {
                    const startRound = parseInt(match[1]);
                    roundsInCurrentOutline = novelSession.currentRound - startRound + 1;
                }
            }

            // Retrieve user choice for this round (Choice made at end of previous round)
            const userChoiceObj = novelSession.choiceHistory.find(c => c.round === novelSession.currentRound - 1);
            const userChoice = userChoiceObj ? userChoiceObj.choice : undefined;

            // Retrieve protagonist profile
            const protagonist = novelSession.characters.find(c => c.isProtagonist);

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
                    roundsInCurrentOutline, // outlineStage
                    novelSession.currentRound, // currentRound
                    userChoice,
                    protagonist, // Pass protagonist profile
                    signal
                );
                return { expertName: expert.name, content: result.content };
            });

            const results = await Promise.all(critiquePromises);

            // Check for votes to update outline
            let voteCount = 0;
            results.forEach(r => {
                if (r.content.includes('【投票：更新大纲】')) {
                    voteCount++;
                }
            });
            const shouldUpdate = voteCount > (novelSession.experts.length / 2);
            if (shouldUpdate) {
                console.log(`[System] Outline update triggered by voting (${voteCount}/${novelSession.experts.length})`);
            }

            set(state => ({
                novelSession: state.novelSession ? {
                    ...state.novelSession,
                    status: 'summarizing',
                    shouldUpdateOutline: shouldUpdate
                } : null,
                isGenerating: false
            }));

            // Proceed to next phase
            get().processNovelCycle();

        } catch (error) {
            const err = error as Error & { name?: string };
            if (err.name === 'AbortError') {
                console.log('Critique aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Critique error:', err);
            set({ error: err.message, isGenerating: false });
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

            await generateCritiqueSummary(
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

        } catch (error) {
            const err = error as Error & { name?: string };
            if (err.name === 'AbortError') {
                console.log('Summary aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Summary error:', err);
            set({ error: err.message, isGenerating: false });
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

            // 1.1 Archive to local file system (Server Call)
            try {
                // Non-blocking call to avoid UI freeze
                fetch('http://localhost:3001/api/save-archive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: novelSession.archiveSessionId,
                        content: finalizedText,
                        round: novelSession.currentRound
                    })
                }).catch(err => console.error("Archive fetch failed:", err));
            } catch (e) {
                console.error("Failed to initiate archive:", e);
            }

            // 1.5. Trigger Analyzers (Characters & Tasks) & Option Generation
            // Run concurrently but WAIT for them before proceeding to ensure state consistency.
            const currentRoundForAnalyzer = novelSession.currentRound;
            const currentCharacters = novelSession.characters || [];
            const currentTasks = novelSession.tasks || [];
            
            // Parallel execution: Analyze State AND Generate Options
            const [analysisResult, options] = await Promise.all([
                // Analysis Task
                Promise.all([
                    analyzeCharacters(finalizedText, currentCharacters, currentRoundForAnalyzer, signal),
                    analyzeTasks(finalizedText, currentTasks, currentRoundForAnalyzer, signal)
                ]).then(([updatedChars, updatedTasks]) => {
                    // Update store immediately with analysis results
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
                    return true; // Signal completion
                }),

                // Option Generation Task
                // Only generate if we are not done with revisions (which is checked below, but we can pre-generate?)
                // Actually, option generation should only happen if we are COMPLETE with revisions.
                // But the original logic was: Check revision completion -> if done -> generate options.
                // Let's stick to the flow but synchronize analysis.
                // Wait, if we are NOT done with revisions, we don't need options.
                // So we should separate them.
                
                // Let's just await analysis first.
            ]);

            // Re-structure:
            // 1. Await Analysis
            await Promise.all([
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
            }).catch((err: unknown) => {
                if (typeof err === 'object' && err !== null && 'name' in err && (err as { name?: unknown }).name === 'AbortError') return;
                console.error("Analyzer error:", err);
            });

            // 2. Check Revision Status & Proceed
            set(state => {
                if (!state.novelSession) return {};
                
                const currentRevision = state.novelSession.currentRevision + 1;
                const isRevisionComplete = currentRevision >= state.novelSession.maxRevisions;

                if (isRevisionComplete) {
                    return {
                         novelSession: {
                            ...state.novelSession,
                            compiledStory: (state.novelSession.compiledStory || '') + '\n\n' + finalizedText,
                        }
                    };
                } else {
                    return {
                        novelSession: {
                            ...state.novelSession,
                            currentRevision: currentRevision,
                            status: 'critiquing',
                        },
                        isGenerating: false
                    };
                }
            });

            // Check if we need to generate options (Revision Complete)
            const { novelSession: checkedSession } = get();
            
            // If we are still 'revising' (status hasn't changed to 'critiquing'), it means we completed the cycle.
            // But wait, the set() above for completion case didn't change status. 
            // It just updated compiledStory. So status is still 'revising'.
            
            // Logic check:
            // If we returned { status: 'critiquing' } above, checkedSession.status is 'critiquing'.
            // If we returned { compiledStory: ... } above, checkedSession.status is 'revising'.
            
            if (checkedSession && checkedSession.status === 'revising') { 
                const options = await generateOptions(finalizedText, signal);
                
                set(state => ({
                    novelSession: state.novelSession ? {
                        ...state.novelSession,
                        currentOptions: options,
                        status: 'selecting_option',
                        currentRevision: 0,
                    } : null,
                    isGenerating: false
                }));
                
                return; // Stop here. Wait for user input.
            }

            // If not completed (status changed to critiquing above), continue automatically
            const { novelSession: updatedSession } = get();
            if (updatedSession && (updatedSession.status === 'drafting' || updatedSession.status === 'critiquing')) {
                // IMPORTANT: Ensure we actually trigger the next cycle
                get().processNovelCycle();
            }

        } catch (error) {
            const err = error as Error & { name?: string };
            if (err.name === 'AbortError') {
                console.log('Revision aborted');
                set({ isGenerating: false });
                return;
            }
            console.error('Revision error:', err);
            set({ error: err.message, isGenerating: false });
        }
    }
  }

}));
