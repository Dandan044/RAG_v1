import { CharacterProfile, StoryTask } from '@/types';
import { useAgentConfigStore } from '@/store/agentConfigStore';
import { useDebugStore } from '@/store/debugStore';
import { v4 as uuidv4 } from 'uuid';
import { deepseekClient } from '@/lib/axios'; // Assuming we can use this or fetch

// Helper to replace template variables (Reusing from deepseek.ts if exported, or redefining)
const processTemplate = (template: string, variables: Record<string, string | number | undefined | null>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value ?? ''));
    }
    return result;
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
        
        // Prepare existing characters summary
        const existingSummary = existingCharacters.map(c => 
            `- ${c.name} (ID: ${c.id}): ${c.description}. 状态: ${c.status}. 位置: ${c.location}`
        ).join('\n') || "暂无记录";

        const systemPrompt = processTemplate(config.systemPrompt, {}); // No vars in template yet

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【现有档案】:\n${existingSummary}\n\n【最新章节】:\n${latestChapter}` }
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
            agentName: 'Character Recorder',
            request: {
                model: config.model,
                systemPrompt: systemPrompt,
                userPrompt: requestBody.messages[1].content,
                temperature: config.temperature
            },
            response: { content }
        });

        // Parse Result
        let result: { updatedCharacters: any[] } = { updatedCharacters: [] };
        try {
            result = JSON.parse(content);
        } catch (e) {
             // Fallback cleanup
             const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
             result = JSON.parse(cleanContent);
        }

        if (!result.updatedCharacters) return existingCharacters;

        // Merge logic
        const newCharacters = [...existingCharacters];
        
        result.updatedCharacters.forEach((charUpdate: any) => {
            if (charUpdate.id) {
                // Update existing
                const index = newCharacters.findIndex(c => c.id === charUpdate.id);
                if (index !== -1) {
                    newCharacters[index] = {
                        ...newCharacters[index],
                        ...charUpdate,
                        lastUpdatedRound: currentRound
                    };
                }
            } else {
                // Try to find by name if ID missing (AI might forget ID)
                const index = newCharacters.findIndex(c => c.name === charUpdate.name);
                if (index !== -1) {
                    newCharacters[index] = {
                        ...newCharacters[index],
                        ...charUpdate,
                        lastUpdatedRound: currentRound
                    };
                } else {
                    // Create new
                    newCharacters.push({
                        ...charUpdate,
                        id: uuidv4(),
                        lastUpdatedRound: currentRound
                    });
                }
            }
        });

        return newCharacters;

    } catch (error) {
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
        
        // Prepare existing tasks summary
        const existingSummary = existingTasks.map(t => 
            `- ${t.title} (ID: ${t.id}) [${t.type}][${t.status}]: ${t.description}. 进度: ${t.progress}`
        ).join('\n') || "暂无任务";

        const systemPrompt = processTemplate(config.systemPrompt, {});

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【现有任务列表】:\n${existingSummary}\n\n【最新章节】:\n${latestChapter}` }
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
            agentName: 'Task Recorder',
            request: {
                model: config.model,
                systemPrompt: systemPrompt,
                userPrompt: requestBody.messages[1].content,
                temperature: config.temperature
            },
            response: { content }
        });

        // Parse Result
        let result: { updatedTasks: any[] } = { updatedTasks: [] };
        try {
            result = JSON.parse(content);
        } catch (e) {
             const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
             result = JSON.parse(cleanContent);
        }

        if (!result.updatedTasks) return existingTasks;

        // Merge logic
        const newTasks = [...existingTasks];
        
        result.updatedTasks.forEach((taskUpdate: any) => {
            if (taskUpdate.id) {
                const index = newTasks.findIndex(t => t.id === taskUpdate.id);
                if (index !== -1) {
                    newTasks[index] = {
                        ...newTasks[index],
                        ...taskUpdate,
                        lastUpdatedRound: currentRound
                    };
                }
            } else {
                // Try find by title
                const index = newTasks.findIndex(t => t.title === taskUpdate.title);
                if (index !== -1) {
                    newTasks[index] = {
                        ...newTasks[index],
                        ...taskUpdate,
                        lastUpdatedRound: currentRound
                    };
                } else {
                    newTasks.push({
                        ...taskUpdate,
                        id: uuidv4(),
                        lastUpdatedRound: currentRound
                    });
                }
            }
        });

        return newTasks;

    } catch (error) {
        console.error('Error analyzing tasks:', error);
        return existingTasks;
    }
};
