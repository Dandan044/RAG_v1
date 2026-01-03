import { CharacterProfile, StoryTask } from '@/types';
import { useAgentConfigStore } from '@/store/agentConfigStore';
import { useDebugStore } from '@/store/debugStore';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore } from '@/lib/vectorStore';

type CharacterUpdate = Partial<CharacterProfile> & { id?: string; name?: string };
type TaskUpdate = Partial<StoryTask> & { id?: string; title?: string };

const isAbortError = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'AbortError';

const parseJsonContent = <T,>(raw: string): T => {
    try {
        return JSON.parse(raw) as T;
    } catch {
        const cleanContent = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanContent) as T;
    }
};

// Helper to replace template variables
const processTemplate = (template: string, variables: Record<string, string | number | undefined | null>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value ?? ''));
    }
    return result;
};

const mergeDefined = <T extends object>(base: T, patch: Partial<T>): T => {
    const definedPatch = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
    return { ...base, ...definedPatch };
};

const buildCharacterProfile = (update: CharacterUpdate, id: string, currentRound: number): CharacterProfile | null => {
    const name = update.name?.trim();
    if (!name) return null;

    return {
        id,
        name,
        description: update.description ?? '',
        status: update.status ?? '',
        location: update.location ?? '',
        relationships: update.relationships ?? '',
        tags: update.tags ?? [],
        lastUpdatedRound: currentRound
    };
};

const buildStoryTask = (update: TaskUpdate, id: string, currentRound: number): StoryTask | null => {
    const title = update.title?.trim();
    if (!title) return null;

    return {
        id,
        title,
        description: update.description ?? '',
        type: update.type ?? 'side',
        status: update.status ?? 'active',
        rewards: update.rewards ?? '',
        progress: update.progress ?? '',
        lastUpdatedRound: currentRound
    };
};

// Helper to update vector store
const updateCharacterVector = async (character: CharacterProfile, round: number) => {
    const text = `姓名：${character.name}\nID：${character.id}\n描述：${character.description}\n状态：${character.status}\n位置：${character.location}\n关系：${character.relationships}\n标签：${character.tags.join(', ')}`;
    await memoryStore.updateEntityDocument(character.id, text, {
        round,
        type: 'character_profile'
    });
};

const updateTaskVector = async (task: StoryTask, round: number) => {
    const text = `任务：${task.title}\nID：${task.id}\n类型：${task.type}\n状态：${task.status}\n描述：${task.description}\n奖励：${task.rewards}\n进度：${task.progress}`;
    await memoryStore.updateEntityDocument(task.id, text, {
        round,
        type: 'story_task'
    });
};

export const analyzeCharacters = async (
    latestChapter: string,
    existingCharacters: CharacterProfile[],
    currentRound: number,
    signal?: AbortSignal
): Promise<CharacterProfile[]> => {
    try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        const config = useAgentConfigStore.getState().getConfig('character_recorder');
        
        // 1. Identify relevant characters
        const relevantCharIds = new Set<string>();

        // A. Semantic Search (RAG)
        const searchResults = await memoryStore.search(latestChapter, 10, true);
        searchResults.forEach(r => {
            if (r.segment.metadata.type === 'character_profile' && r.segment.metadata.entityId) {
                relevantCharIds.add(r.segment.metadata.entityId);
            }
        });

        // B. Exact Name Matching (Mapping)
        // Check if any existing character's name appears in the text
        existingCharacters.forEach(char => {
            if (latestChapter.includes(char.name)) {
                relevantCharIds.add(char.id);
            }
        });

        // 2. Retrieve Documents
        // We use the "Mapping" (ID -> Document) to get the precise record
        const relevantDocs: string[] = [];
        const relevantCharacters: CharacterProfile[] = [];

        relevantCharIds.forEach(id => {
            const char = existingCharacters.find(c => c.id === id);
            if (char) {
                relevantCharacters.push(char);
                // Try to get from vector store first for latest text
                const doc = memoryStore.getDocumentByEntityId(id);
                if (doc) {
                    relevantDocs.push(doc.text);
                } else {
                    // Fallback to constructing from current profile
                    relevantDocs.push(`姓名：${char.name} (ID: ${char.id})\n描述：${char.description}\n状态：${char.status}\n位置：${char.location}`);
                }
            }
        });
        
        const existingSummary = relevantDocs.join('\n\n') || "暂无相关角色记录";

        const systemPrompt = processTemplate(config.systemPrompt, {}); 

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【相关角色档案】:\n${existingSummary}\n\n【最新章节】:\n${latestChapter}` }
            ],
            temperature: config.temperature,
            response_format: { type: 'json_object' }
        };

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) throw new Error('Failed to analyze characters');
        const data = await response.json();
        const content = data.choices[0].message.content;

        useDebugStore.getState().addLog({
            type: 'system',
            agentName: 'Character Recorder (人物记录员)',
            request: {
                model: config.model,
                systemPrompt: systemPrompt,
                userPrompt: requestBody.messages[1].content,
                temperature: config.temperature
            },
            response: { content }
        });

        // Parse Result
        const result = parseJsonContent<{ updatedCharacters?: CharacterUpdate[] }>(content);
        if (!result.updatedCharacters) return existingCharacters;

        // Merge logic
        const newCharacters = [...existingCharacters];
        const updatesPromises: Promise<void>[] = [];
        
        result.updatedCharacters.forEach((charUpdate) => {
            let updatedChar: CharacterProfile | null = null;

            if (charUpdate.id) {
                // Update existing
                const index = newCharacters.findIndex(c => c.id === charUpdate.id);
                if (index !== -1) {
                    newCharacters[index] = {
                        ...mergeDefined(newCharacters[index], charUpdate),
                        lastUpdatedRound: currentRound
                    };
                    updatedChar = newCharacters[index];
                }
            } else {
                // Try to find by name if ID missing
                const index = newCharacters.findIndex(c => c.name === charUpdate.name);
                if (index !== -1) {
                    newCharacters[index] = {
                        ...mergeDefined(newCharacters[index], charUpdate),
                        lastUpdatedRound: currentRound
                    };
                    updatedChar = newCharacters[index];
                } else {
                    // Create new
                    const built = buildCharacterProfile(charUpdate, uuidv4(), currentRound);
                    if (built) {
                        newCharacters.push(built);
                        updatedChar = built;
                    }
                }
            }

            // Sync to Vector Store
            if (updatedChar) {
                updatesPromises.push(updateCharacterVector(updatedChar, currentRound));
            }
        });

        await Promise.all(updatesPromises);

        return newCharacters;

    } catch (error) {
        if (isAbortError(error)) return existingCharacters;
        console.error('Error analyzing characters:', error);
        return existingCharacters;
    }
};

export const analyzeTasks = async (
    latestChapter: string,
    existingTasks: StoryTask[],
    currentRound: number,
    signal?: AbortSignal
): Promise<StoryTask[]> => {
    try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        const config = useAgentConfigStore.getState().getConfig('task_recorder');
        
        // 1. Identify relevant tasks
        const relevantTaskIds = new Set<string>();

        // A. Semantic Search (RAG)
        const searchResults = await memoryStore.search(latestChapter, 10, true);
        searchResults.forEach(r => {
            if (r.segment.metadata.type === 'story_task' && r.segment.metadata.entityId) {
                relevantTaskIds.add(r.segment.metadata.entityId);
            }
        });

        // B. Exact Title Matching
        existingTasks.forEach(task => {
            if (latestChapter.includes(task.title)) {
                relevantTaskIds.add(task.id);
            }
        });

        // 2. Retrieve Documents
        const relevantDocs: string[] = [];
        const relevantTasks: StoryTask[] = [];

        relevantTaskIds.forEach(id => {
            const task = existingTasks.find(t => t.id === id);
            if (task) {
                relevantTasks.push(task);
                const doc = memoryStore.getDocumentByEntityId(id);
                if (doc) {
                    relevantDocs.push(doc.text);
                } else {
                    relevantDocs.push(`任务：${task.title} (ID: ${task.id})\n类型：${task.type}\n状态：${task.status}\n描述：${task.description}\n进度：${task.progress}`);
                }
            }
        });
        
        const existingSummary = relevantDocs.join('\n\n') || "暂无相关任务记录";

        const systemPrompt = processTemplate(config.systemPrompt, {});

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【相关任务列表】:\n${existingSummary}\n\n【最新章节】:\n${latestChapter}` }
            ],
            temperature: config.temperature,
            response_format: { type: 'json_object' }
        };

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) throw new Error('Failed to analyze tasks');
        const data = await response.json();
        const content = data.choices[0].message.content;

        useDebugStore.getState().addLog({
            type: 'system',
            agentName: 'Task Recorder (任务记录员)',
            request: {
                model: config.model,
                systemPrompt: systemPrompt,
                userPrompt: requestBody.messages[1].content,
                temperature: config.temperature
            },
            response: { content }
        });

        // Parse Result
        const result = parseJsonContent<{ updatedTasks?: TaskUpdate[] }>(content);
        if (!result.updatedTasks) return existingTasks;

        // Merge logic
        const newTasks = [...existingTasks];
        const updatesPromises: Promise<void>[] = [];
        
        result.updatedTasks.forEach((taskUpdate) => {
            let updatedTask: StoryTask | null = null;

            if (taskUpdate.id) {
                const index = newTasks.findIndex(t => t.id === taskUpdate.id);
                if (index !== -1) {
                    newTasks[index] = {
                        ...mergeDefined(newTasks[index], taskUpdate),
                        lastUpdatedRound: currentRound
                    };
                    updatedTask = newTasks[index];
                }
            } else {
                // Try find by title
                const index = newTasks.findIndex(t => t.title === taskUpdate.title);
                if (index !== -1) {
                    newTasks[index] = {
                        ...mergeDefined(newTasks[index], taskUpdate),
                        lastUpdatedRound: currentRound
                    };
                    updatedTask = newTasks[index];
                } else {
                    const built = buildStoryTask(taskUpdate, uuidv4(), currentRound);
                    if (built) {
                        newTasks.push(built);
                        updatedTask = built;
                    }
                }
            }

            // Sync to Vector Store
            if (updatedTask) {
                updatesPromises.push(updateTaskVector(updatedTask, currentRound));
            }
        });

        await Promise.all(updatesPromises);

        return newTasks;

    } catch (error) {
        if (isAbortError(error)) return existingTasks;
        console.error('Error analyzing tasks:', error);
        return existingTasks;
    }
};
