import { deepseekClient } from '@/lib/axios';
  import { Expert, DiscussionMessage, CharacterProfile } from '@/types';
  import { v4 as uuidv4 } from 'uuid';
  import { memoryStore } from '@/lib/vectorStore';
import { useDebugStore } from '@/store/debugStore';
import { useAgentConfigStore } from '@/store/agentConfigStore';

// Helper to replace template variables
const processTemplate = (template: string, variables: Record<string, string | number | undefined | null>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value ?? ''));
    }
    return result;
};

type JsonRecord = Record<string, unknown>;

type ChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type ChatTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonRecord;
  };
};

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
  tools?: ChatTool[];
  thinking?: { type: 'enabled' };
};

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const isAbortError = (error: unknown): boolean =>
  isRecord(error) && typeof error.name === 'string' && error.name === 'AbortError';

const parseJsonLoose = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(clean) as unknown;
  }
};

const extractExpertsArray = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.experts)) return parsed.experts;
  throw new Error('Parsed experts data is not an array');
};

const getString = (obj: JsonRecord, key: string): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

const normalizeExpert = (raw: unknown): Expert => {
  if (!isRecord(raw)) {
    const name = '未知专家';
    return {
      id: uuidv4(),
      name,
      field: '',
      personality: '',
      initialStance: '',
      color: '#64748b',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    };
  }

  const name = getString(raw, 'name') ?? '未知专家';

  return {
    id: uuidv4(),
    name,
    field: getString(raw, 'field') ?? '',
    personality: getString(raw, 'personality') ?? '',
    initialStance: getString(raw, 'initialStance') ?? '',
    color: getString(raw, 'color') ?? '#64748b',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
  };
};

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_novel_memory",
    description: "检索关于人物（性格、外貌、经历）、任务（当前进度、目标）、剧情（前文发生的事）等信息。当需要引用具体设定或回顾前文时请务必使用。",
    parameters: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          description: "查询关键词列表，例如 ['主角现在的任务', '反派的弱点', '上一章发生的爆炸']"
        }
      },
      required: ["queries"]
    }
  }
};

export const generateExperts = async (topic: string, count: number = 5): Promise<Expert[]> => {
  try {
    const config = useAgentConfigStore.getState().getConfig('expert_generator');
    const systemPrompt = processTemplate(config.systemPrompt, { topic, count });

    const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `为话题生成 ${count} 位专家：${topic}`
        }
      ];

    const response = await deepseekClient.post('/chat/completions', {
      model: config.model,
      messages,
      temperature: config.temperature,
      response_format: { type: 'json_object' }
    });

    const content = response.data.choices[0].message.content;
    
    // Log debug info
    useDebugStore.getState().addLog({
        type: 'system',
        agentName: 'Expert Generator (专家生成器)',
        request: {
            model: config.model,
            systemPrompt: messages[0].content as string,
            userPrompt: messages[1].content as string,
            temperature: config.temperature
        },
        response: {
            content: content
        }
    });

    const parsed = parseJsonLoose(content);
    const expertsData = extractExpertsArray(parsed);
    return expertsData.map(normalizeExpert);
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating experts:', error);
    throw error;
  }
};

export const generateExpertResponse = async (
  topic: string,
  currentExpert: Expert,
  previousMessages: DiscussionMessage[],
  experts: Expert[],
  enableThinking: boolean,
  onChunk?: (content: string, type: 'content' | 'thinking') => void
): Promise<{ content: string; thinking: string }> => {
  try {
    const context = previousMessages.map(msg => {
      const expert = experts.find(e => e.id === msg.expertId);
      return `${expert?.name} (${expert?.field}): ${msg.content}`;
    }).join('\n');

    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('expert_responder');
    const systemPrompt = processTemplate(config.systemPrompt, {
        name: currentExpert.name,
        field: currentExpert.field,
        personality: currentExpert.personality,
        initialStance: currentExpert.initialStance,
        topic
    });
    
    const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `目前的讨论进展如下：\n\n${context}\n\n现在轮到你发言了。你的观点是什么？`
        }
    ];

    const requestBody: ChatRequest = {
      model: config.model,
      messages,
      tools: [SEARCH_TOOL as ChatTool],
      temperature: config.temperature,
      stream: true
    };

    if (enableThinking) {
      requestBody.thinking = { type: 'enabled' };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.body) throw new Error('No response body');
    
    // Custom stream processor for tool calls (Copied from generateExpertCritique logic)
    const result = await (async () => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let fullThinking = '';
        let toolCallBuffer: { id: string; name: string } | null = null;
        let toolCallArgs = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trimStart();
            if (payload === '[DONE]' || payload.length === 0) continue;
            try {
                const data = JSON.parse(payload);
                if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) continue;
                
                const delta = data.choices[0].delta;
                if (!delta) continue;
                
                if (delta.reasoning_content) {
                    fullThinking += delta.reasoning_content;
                    onChunk?.(delta.reasoning_content, 'thinking');
                }
                
                if (delta.tool_calls) {
                    const first = delta.tool_calls[0];
                    const id = first?.id;
                    const name = first?.function?.name;
                    if (!toolCallBuffer && id && name) toolCallBuffer = { id, name };
                }
                
                if (toolCallBuffer && delta.tool_calls?.[0]?.function?.arguments) {
                    toolCallArgs += delta.tool_calls[0].function.arguments ?? '';
                }

                if (delta.content) {
                    fullContent += delta.content;
                    onChunk?.(delta.content, 'content');
                }

                if (data.choices[0].finish_reason === 'tool_calls') {
                    if (toolCallBuffer && toolCallBuffer.name === 'search_novel_memory') {
                        const args = (() => {
                            try { return JSON.parse(toolCallArgs) as { queries?: unknown }; } catch { return {}; }
                        })();

                        const queries = Array.isArray(args.queries)
                            ? args.queries.filter((q): q is string => typeof q === 'string')
                            : [];
                        let searchResults = '';
                        
                        if (queries.length > 0) {
                            for (const q of queries) {
                                const results = await memoryStore.search(q);
                                searchResults += `查询 "${q}":\n` + (results.length > 0 ? results.map(r => `- ${r.segment.text}`).join('\n') : "未找到相关信息") + '\n\n';
                            }
                        } else {
                            searchResults = "未提供有效查询词，未执行检索。";
                        }
                        
                        const toolMsg = {
                            role: 'assistant',
                            content: null,
                            tool_calls: [{
                                id: toolCallBuffer.id,
                                type: 'function',
                                function: {
                                    name: toolCallBuffer.name,
                                    arguments: toolCallArgs
                                }
                            }]
                        } satisfies ChatMessage;
                        const toolOutputMsg = {
                            role: 'tool',
                            tool_call_id: toolCallBuffer.id,
                            content: searchResults || "未找到相关记忆。"
                        } satisfies ChatMessage;
                        
                        const searchLog = `\n[系统] 正在检索记忆库: ${queries.join(', ')}...\n找到相关信息:\n${searchResults}\n`;
                        onChunk?.(searchLog, 'thinking');
                        fullThinking += searchLog;

                        toolCallBuffer = null;
                        toolCallArgs = '';

                        const nextResponse = await fetch('https://api.deepseek.com/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: config.model,
                                messages: [...messages, toolMsg, toolOutputMsg],
                                temperature: config.temperature,
                                stream: true,
                                thinking: enableThinking ? { type: 'enabled' } : undefined
                            })
                        });
                        
                        return processStreamResponse(nextResponse, onChunk);
                    }
                }

            } catch {
              continue;
            }
          }
        }
        return { content: fullContent, thinking: fullThinking };
    })();

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'expert',
        agentName: `${currentExpert.name} (${currentExpert.field})`,
        request: {
            model: config.model,
            systemPrompt: requestBody.messages[0].content,
            userPrompt: requestBody.messages[1].content,
            temperature: config.temperature
        },
        response: {
            content: result.content,
            thinking: result.thinking
        }
    });

    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating response:', error);
    throw error;
  }
};

export const generateConclusion = async (
  topic: string,
  messages: DiscussionMessage[],
  experts: Expert[],
  onChunk?: (content: string) => void
): Promise<string> => {
  try {
    const context = messages.map(msg => {
      const expert = experts.find(e => e.id === msg.expertId);
      return `${expert?.name} (${expert?.field}): ${msg.content}`;
    }).join('\n');

    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('conclusion_generator');
    const systemPrompt = processTemplate(config.systemPrompt, { topic });
    
    const requestMessages = [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `讨论记录如下：\n\n${context}\n\n请进行总结。`
          }
        ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: requestMessages,
        temperature: config.temperature,
        stream: true
      })
    });

    if (!response.body) throw new Error('No response body');
    
    const result = await processStreamResponse(response, (content, type) => {
         if (type === 'content' && onChunk) onChunk(content);
    });

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'moderator',
        agentName: 'Conclusion Generator (总结生成器)',
        request: {
            model: config.model,
            systemPrompt: requestMessages[0].content as string,
            userPrompt: requestMessages[1].content as string,
            temperature: config.temperature
        },
        response: {
            content: result.content
        }
    });

    return result.content;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating conclusion:', error);
    throw error;
  }
};

// Novel Workflow API Functions

export const generateExpertSuggestions = async (requirements: string, count: number = 5): Promise<Expert[]> => {
  try {
    const config = useAgentConfigStore.getState().getConfig('expert_suggestion');
    const systemPrompt = processTemplate(config.systemPrompt, { count });

    const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `小说要求：${requirements}`
        }
      ];

    const response = await deepseekClient.post('/chat/completions', {
      model: config.model,
      messages,
      temperature: config.temperature,
      response_format: { type: 'json_object' }
    });

    const content = response.data.choices[0].message.content;
    
    // Log debug info
    useDebugStore.getState().addLog({
        type: 'system',
        agentName: 'Expert Suggestion System (专家推荐系统)',
        request: {
            model: config.model,
            systemPrompt: messages[0].content as string,
            userPrompt: messages[1].content as string,
            temperature: config.temperature
        },
        response: {
            content: content
        }
    });

    const parsed = parseJsonLoose(content);
    const expertsData = extractExpertsArray(parsed);
    return expertsData.map(normalizeExpert);
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating expert suggestions:', error);
    throw error;
  }
};

export const summarizeStory = async (content: string): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('story_summarizer');
    
    const messages = [
          {
            role: 'system',
            content: config.systemPrompt
          },
          {
            role: 'user',
            content
          }
        ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        stream: false
      })
    });
    const data = await response.json();
    const result = data.choices[0].message.content;

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'summary',
        agentName: 'Story Summarizer (剧情摘要器)',
        request: {
            model: config.model,
            systemPrompt: messages[0].content as string,
            userPrompt: messages[1].content as string,
            temperature: config.temperature
        },
        response: {
            content: result
        }
    });

    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error summarizing story:', error);
    return content.slice(-2000); // Fallback
  }
};

export const generateNovelSegment = async (
  requirements: string,
  previousContent: string, // This now contains the pre-processed context (summaries + recent text)
  segmentIndex: number,
  enableThinking: boolean,
  onChunk?: (content: string, type: 'content' | 'thinking') => void,
  worldview?: string,
  outline?: string,
  outlineStage?: number, // New: Stage of outline (1-5)
  userChoice?: string,
  protagonistProfile?: CharacterProfile,
  signal?: AbortSignal
): Promise<{ content: string; thinking: string }> => {
  try {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('novel_writer');

    // Process variables for prompt
    const worldviewMsg = worldview ? `【世界观设定】（必须严格遵守）：\n${worldview}\n` : '';
    const outlineMsg = outline ? `【当前阶段大纲】（必须严格执行）：\n${outline}\n` : '';
    const outlineStageMsg = outlineStage ? `【大纲进度】：这是当前大纲阶段的第 ${outlineStage} 次写作。请把控好剧情节奏，稳步推进剧情。\n` : '';
    
    // Process protagonist status
    let protagonistMsg = '';
    if (protagonistProfile) {
        protagonistMsg = `【主角状态】（必须遵守）：\n`;
        if (protagonistProfile.bodyStatus && Object.keys(protagonistProfile.bodyStatus).length > 0) {
            protagonistMsg += `- 身体状况：${Object.values(protagonistProfile.bodyStatus).map(p => `${p.name}: ${p.status} (${p.severity})`).join('; ')}\n`;
        } else {
            protagonistMsg += `- 身体状况：良好\n`;
        }
        
        if (protagonistProfile.inventory && protagonistProfile.inventory.length > 0) {
            protagonistMsg += `- 物品栏（只能使用以下物品）：${protagonistProfile.inventory.join(', ')}\n`;
        } else {
            protagonistMsg += `- 物品栏：空（不可凭空使用物品）\n`;
        }
    }

    const systemPrompt = processTemplate(config.systemPrompt, {
        segmentIndex: segmentIndex + 1,
        totalSegmentMsg: '',
        worldview: worldviewMsg,
        outline: outlineMsg,
        outlineStageMsg,
        userChoice: userChoice || "无（起始章节）",
        protagonistStatus: protagonistMsg
    });

    const requestBody: ChatRequest = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `小说要求：${requirements}\n\n前文内容：\n${previousContent}\n\n请继续创作下一段内容（注意字数限制在100-1500字以内，**仅输出正文**）。`
        }
      ],
      temperature: config.temperature,
      stream: true
    };

    if (enableThinking) {
      requestBody.thinking = { type: 'enabled' };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.body) throw new Error('No response body');
    const result = await processStreamResponse(response, onChunk);

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'writer',
        agentName: 'Novel Writer (小说家)',
        request: {
            model: config.model,
            systemPrompt: requestBody.messages[0].content,
            userPrompt: requestBody.messages[1].content,
            temperature: config.temperature
        },
        response: {
            content: result.content,
            thinking: result.thinking
        }
    });

    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating novel segment:', error);
    throw error;
  }
};

export const generateExpertCritique = async (
  draft: string,
  expert: Expert,
  enableThinking: boolean,
  onChunk?: (content: string, type: 'content' | 'thinking') => void,
  worldview?: string,
  outline?: string,
  outlineStage?: number,
  currentRound?: number,
  userChoice?: string,
  protagonistProfile?: CharacterProfile,
  signal?: AbortSignal
): Promise<{ content: string; thinking: string }> => {
  try {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('expert_critique');
    
    // Tools definition for DeepSeek
    const tools = [SEARCH_TOOL as ChatTool];

    // Process variables
    const worldviewMsg = worldview ? `【世界观设定】：\n${worldview}\n` : '';
    const outlineMsg = outline ? `同时请检查剧情走向是否符合【当前阶段大纲】：\n${outline}` : '';
    const outlineStageMsg = outlineStage ? `【大纲进度】：这是当前大纲阶段的第 ${outlineStage} 次写作。` : '';
    
    // Process protagonist status
    let protagonistMsg = '';
    if (protagonistProfile) {
        protagonistMsg = `【主角状态】：\n`;
        if (protagonistProfile.bodyStatus && Object.keys(protagonistProfile.bodyStatus).length > 0) {
            protagonistMsg += `- 身体状况：${Object.values(protagonistProfile.bodyStatus).map(p => `${p.name}: ${p.status} (${p.severity})`).join('; ')}\n`;
        } else {
            protagonistMsg += `- 身体状况：良好\n`;
        }
        
        if (protagonistProfile.inventory && protagonistProfile.inventory.length > 0) {
            protagonistMsg += `- 物品栏：${protagonistProfile.inventory.join(', ')}\n`;
        } else {
            protagonistMsg += `- 物品栏：空\n`;
        }
    }

    const thinkingInstruction = enableThinking 
            ? `4. **无错即止**：如果发现没有明显的逻辑漏洞或硬伤，请直接回答“无逻辑漏洞，无需修改”。` 
            : `4. **简要分析**：如果未发现明显漏洞，请先简要说明（1-2句）确认了哪些逻辑点（如时间线、因果等）是连贯的，然后总结“无逻辑漏洞，无需修改”。`;

    const systemPrompt = processTemplate(config.systemPrompt, {
        field: expert.field,
        name: expert.name,
        personality: expert.personality,
        worldview: worldviewMsg,
        outline: outlineMsg,
        outlineStageMsg,
        thinkingInstruction,
        userChoice: userChoice || "无",
        protagonistStatus: protagonistMsg
    });

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `小说草稿 (第${currentRound}轮)：\n${draft}\n\n请给出你的评审意见。`
      }
    ];

    const requestBody: ChatRequest = {
      model: config.model,
      messages: messages,
      tools: tools as ChatTool[],
      temperature: config.temperature,
      stream: true
    };

    if (enableThinking) {
      requestBody.thinking = { type: 'enabled' };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.body) throw new Error('No response body');

    // Custom stream processor for tool calls
    const result = await (async () => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let fullThinking = '';
        let toolCallBuffer: { id: string; name: string } | null = null;
        let toolCallArgs = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trimStart();
            if (payload === '[DONE]' || payload.length === 0) continue;
            try {
                const data = JSON.parse(payload) as {
                    choices?: Array<{
                        delta?: {
                            reasoning_content?: string;
                            content?: string;
                            tool_calls?: Array<{
                                id?: string;
                                function?: { name?: string; arguments?: string };
                            }>;
                        };
                        finish_reason?: string;
                    }>;
                };
                if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) continue;
                
                const delta = data.choices[0].delta;
                if (!delta) continue;
                
                if (delta.reasoning_content) {
                fullThinking += delta.reasoning_content;
                onChunk?.(delta.reasoning_content, 'thinking');
                }
                
                if (delta.tool_calls) {
                    const first = delta.tool_calls[0];
                    const id = first?.id;
                    const name = first?.function?.name;
                    if (!toolCallBuffer && id && name) toolCallBuffer = { id, name };
                }
                
                if (toolCallBuffer && delta.tool_calls?.[0]?.function?.arguments) {
                    toolCallArgs += delta.tool_calls[0].function.arguments ?? '';
                }

                if (delta.content) {
                fullContent += delta.content;
                onChunk?.(delta.content, 'content');
                }

                if (data.choices[0].finish_reason === 'tool_calls') {
                    if (toolCallBuffer && toolCallBuffer.name === 'search_novel_memory') {
                        // Safe parse arguments
                        const args = (() => {
                            try {
                                return JSON.parse(toolCallArgs) as { queries?: unknown };
                            } catch {
                                return {};
                            }
                        })();

                        const queries = Array.isArray(args.queries)
                            ? args.queries.filter((q): q is string => typeof q === 'string')
                            : [];
                        let searchResults = '';
                        
                        if (queries.length > 0) {
                            for (const q of queries) {
                                const results = await memoryStore.search(q);
                                searchResults += `查询 "${q}":\n` + (results.length > 0 ? results.map(r => `- ${r.segment.text}`).join('\n') : "未找到相关信息") + '\n\n';
                            }
                        } else {
                            searchResults = "未提供有效查询词，未执行检索。";
                        }
                        
                        const toolMsg = {
                            role: 'assistant',
                            content: null,
                            tool_calls: [{
                                id: toolCallBuffer.id,
                                type: 'function',
                                function: {
                                    name: toolCallBuffer.name,
                                    arguments: toolCallArgs
                                }
                            }]
                        } satisfies ChatMessage;
                        const toolOutputMsg = {
                            role: 'tool',
                            tool_call_id: toolCallBuffer.id,
                            content: searchResults || "未找到相关记忆。"
                        } satisfies ChatMessage;
                        
                        const searchLog = `\n[系统] 正在检索记忆库: ${queries.join(', ')}...\n找到相关信息:\n${searchResults}\n`;
                        onChunk?.(searchLog, 'thinking');
                        fullThinking += searchLog;

                        // IMPORTANT: Reset tool buffer
                        toolCallBuffer = null;
                        toolCallArgs = '';

                        const nextResponse = await fetch('https://api.deepseek.com/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: config.model,
                                messages: [...messages, toolMsg, toolOutputMsg],
                                temperature: config.temperature,
                                stream: true,
                                thinking: enableThinking ? { type: 'enabled' } : undefined
                            }),
                            signal
                        });
                        
                        return processStreamResponse(nextResponse, onChunk);
                    }
                }

            } catch {
              continue;
            }
          }
        }

        return { content: fullContent, thinking: fullThinking };
    })();

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'expert',
        agentName: expert.name,
        request: {
            model: config.model,
            systemPrompt: requestBody.messages[0].content,
            userPrompt: requestBody.messages[1].content,
            temperature: config.temperature
        },
        response: {
            content: result.content,
            thinking: result.thinking
        }
    });

    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating expert critique:', error);
    throw error;
  }
};

export const generateCritiqueSummary = async (
  draft: string,
  critiques: { expertName: string; content: string }[],
  onChunk?: (content: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  try {
    const critiquesText = critiques.map(c => `${c.expertName}: ${c.content}`).join('\n\n');
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('critique_summarizer');
    
    const messages = [
          {
            role: 'system',
            content: config.systemPrompt
          },
          {
            role: 'user',
            content: `小说草稿：\n${draft}\n\n专家意见：\n${critiquesText}\n\n请生成修改指南。`
          }
        ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        stream: true
      }),
      signal
    });

    if (!response.body) throw new Error('No response body');
    
    const result = await processStreamResponse(response, (content, type) => {
        if (type === 'content' && onChunk) onChunk(content);
    });

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'moderator',
        agentName: 'Critique Summarizer (评审总结器)',
        request: {
            model: config.model,
            systemPrompt: messages[0].content as string,
            userPrompt: messages[1].content as string,
            temperature: config.temperature
        },
        response: {
            content: result.content
        }
    });

    return result.content;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error generating critique summary:', error);
    throw error;
  }
};

export const rewriteNovel = async (
  originalDraft: string,
  summary: string,
  requirements: string,
  enableThinking: boolean,
  onChunk?: (content: string, type: 'content' | 'thinking') => void,
  signal?: AbortSignal
): Promise<{ content: string; thinking: string }> => {
  try {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const config = useAgentConfigStore.getState().getConfig('novel_rewriter');

    const systemPrompt = processTemplate(config.systemPrompt, { requirements });
    
    const requestBody: ChatRequest = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `原始草稿：\n${originalDraft}\n\n修改指南：\n${summary}\n\n请重写小说（仅输出正文，禁止包含修改说明）。`
        }
      ],
      temperature: config.temperature,
      stream: true
    };

    if (enableThinking) {
      requestBody.thinking = { type: 'enabled' };
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.body) throw new Error('No response body');
    const result = await processStreamResponse(response, onChunk);

    // Log debug info
    useDebugStore.getState().addLog({
        type: 'writer',
        agentName: 'Novel Writer (Revision) (小说家-修订)',
        request: {
            model: config.model,
            systemPrompt: requestBody.messages[0].content,
            userPrompt: requestBody.messages[1].content,
            temperature: config.temperature
        },
        response: {
            content: result.content,
            thinking: result.thinking
        }
    });

    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Error rewriting novel:', error);
    throw error;
  }
};

export const generateOutlineContribution = async (
    expert: Expert,
    worldview: string,
    requirements: string,
    historyOutline: string, // Previous outlines
    currentRound: number,
    otherOpinions: string,
    enableThinking: boolean,
    onChunk?: (content: string, type: 'content' | 'thinking') => void,
    signal?: AbortSignal
): Promise<{ content: string; thinking: string }> => {
    try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        const config = useAgentConfigStore.getState().getConfig('outline_contributor');

        const systemPrompt = processTemplate(config.systemPrompt, {
            field: expert.field,
            name: expert.name,
            personality: expert.personality,
            worldview,
            historyOutline: historyOutline || "无（起始阶段）",
            otherOpinions: otherOpinions || "暂无",
            currentRound,
            endRound: currentRound + 4
        });

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请发表你对接下来5轮剧情的大纲建议。` }
        ];

        const requestBody: ChatRequest = {
            model: config.model,
            messages,
            tools: [SEARCH_TOOL as ChatTool],
            temperature: config.temperature,
            stream: true
        };

        if (enableThinking) requestBody.thinking = { type: 'enabled' };

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.body) throw new Error('No response body');

        // Custom stream processor for tool calls
        const result = await (async () => {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let fullThinking = '';
            let toolCallBuffer: { id: string; name: string } | null = null;
            let toolCallArgs = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trimEnd();
                    if (!trimmed.startsWith('data:')) continue;
                    const payload = trimmed.slice(5).trimStart();
                    if (payload === '[DONE]' || payload.length === 0) continue;
                    try {
                        const data = JSON.parse(payload);
                        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) continue;

                        const delta = data.choices[0].delta;
                        if (!delta) continue;

                        if (delta.reasoning_content) {
                            fullThinking += delta.reasoning_content;
                            onChunk?.(delta.reasoning_content, 'thinking');
                        }

                        if (delta.tool_calls) {
                            const first = delta.tool_calls[0];
                            const id = first?.id;
                            const name = first?.function?.name;
                            if (!toolCallBuffer && id && name) toolCallBuffer = { id, name };
                        }

                        if (toolCallBuffer && delta.tool_calls?.[0]?.function?.arguments) {
                            toolCallArgs += delta.tool_calls[0].function.arguments ?? '';
                        }

                        if (delta.content) {
                            fullContent += delta.content;
                            onChunk?.(delta.content, 'content');
                        }

                        if (data.choices[0].finish_reason === 'tool_calls') {
                            if (toolCallBuffer && toolCallBuffer.name === 'search_novel_memory') {
                                const args = (() => {
                                    try { return JSON.parse(toolCallArgs) as { queries?: unknown }; } catch { return {}; }
                                })();

                                const queries = Array.isArray(args.queries)
                                    ? args.queries.filter((q): q is string => typeof q === 'string')
                                    : [];
                                let searchResults = '';

                                if (queries.length > 0) {
                                    for (const q of queries) {
                                        const results = await memoryStore.search(q);
                                        searchResults += `查询 "${q}":\n` + (results.length > 0 ? results.map(r => `- ${r.segment.text}`).join('\n') : "未找到相关信息") + '\n\n';
                                    }
                                } else {
                                    searchResults = "未提供有效查询词，未执行检索。";
                                }

                                const toolMsg = {
                                    role: 'assistant',
                                    content: null,
                                    tool_calls: [{
                                        id: toolCallBuffer.id,
                                        type: 'function',
                                        function: {
                                            name: toolCallBuffer.name,
                                            arguments: toolCallArgs
                                        }
                                    }]
                                } satisfies ChatMessage;
                                const toolOutputMsg = {
                                    role: 'tool',
                                    tool_call_id: toolCallBuffer.id,
                                    content: searchResults || "未找到相关记忆。"
                                } satisfies ChatMessage;

                                const searchLog = `\n[系统] 正在检索记忆库: ${queries.join(', ')}...\n找到相关信息:\n${searchResults}\n`;
                                onChunk?.(searchLog, 'thinking');
                                fullThinking += searchLog;

                                toolCallBuffer = null;
                                toolCallArgs = '';

                                const nextResponse = await fetch('https://api.deepseek.com/chat/completions', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${apiKey}`
                                    },
                                    body: JSON.stringify({
                                        model: config.model,
                                        messages: [...messages, toolMsg, toolOutputMsg],
                                        temperature: config.temperature,
                                        stream: true,
                                        thinking: enableThinking ? { type: 'enabled' } : undefined
                                    }),
                                    signal
                                });

                                return processStreamResponse(nextResponse, onChunk);
                            }
                        }

                    } catch {
                        continue;
                    }
                }
            }
            return { content: fullContent, thinking: fullThinking };
        })();

        // Log debug info
        useDebugStore.getState().addLog({
            type: 'outline',
            agentName: `${expert.name} (${expert.field})`,
            request: {
                model: config.model,
                systemPrompt: requestBody.messages[0].content,
                userPrompt: requestBody.messages[1].content,
                temperature: config.temperature
            },
            response: {
                content: result.content,
                thinking: result.thinking
            }
        });

        return result;
    } catch (error) {
        if (isAbortError(error)) throw error;
        console.error('Error generating outline contribution:', error);
        throw error;
    }
};

export const generateOutlineSummary = async (
    discussion: string,
    currentRound: number,
    onChunk?: (content: string) => void,
    signal?: AbortSignal
): Promise<string> => {
    try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        const config = useAgentConfigStore.getState().getConfig('outline_summarizer');
        
        const systemPrompt = processTemplate(config.systemPrompt, {
            currentRound,
            endRound: currentRound + 4
        });

        const messages = [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `专家讨论记录：\n${discussion}\n\n请生成大纲。`
                    }
                ];

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: config.temperature,
                stream: true
            }),
            signal
        });

        if (!response.body) throw new Error('No response body');
        const result = await processStreamResponse(response, (content, type) => {
             if (type === 'content' && onChunk) onChunk(content);
        });

        // Log debug info
        useDebugStore.getState().addLog({
            type: 'outline',
            agentName: 'Outline Summarizer (大纲总结器)',
            request: {
                model: config.model,
                systemPrompt: messages[0].content as string,
                userPrompt: messages[1].content as string,
                temperature: config.temperature
            },
            response: {
                content: result.content
            }
        });

        return result.content;
    } catch (error) {
        if (isAbortError(error)) throw error;
        console.error('Error generating outline summary:', error);
        throw error;
    }
};

export const generateWorldview = async (requirements: string, signal?: AbortSignal): Promise<string> => {
    try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        const config = useAgentConfigStore.getState().getConfig('worldview_architect');
        
        // No variables for worldview prompt yet, but good to have ready
        const systemPrompt = processTemplate(config.systemPrompt, {});

        const messages = [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `小说需求：${requirements}\n\n请设计世界观。`
                    }
                ];

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: config.temperature,
                stream: false
            }),
            signal // Pass abort signal
        });
        const data = await response.json();
        const result = data.choices[0].message.content;

        // Log debug info
        useDebugStore.getState().addLog({
            type: 'system',
            agentName: 'Worldview Architect (世界观架构师)',
            request: {
                model: config.model,
                systemPrompt: messages[0].content as string,
                userPrompt: messages[1].content as string,
                temperature: config.temperature
            },
            response: {
                content: result
            }
        });

        return result;
    } catch (error: unknown) {
        if (isAbortError(error)) {
             console.log('Worldview generation aborted');
             throw error;
        }
        console.error('Error generating worldview:', error);
        return "无法生成世界观，请手动补充。";
    }
};

// Helper function to process SSE stream
async function processStreamResponse(
    response: Response, 
    onChunk?: (content: string, type: 'content' | 'thinking') => void
): Promise<{ content: string; thinking: string }> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullThinking = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trimStart();
        if (payload === '[DONE]' || payload.length === 0) continue;
          try {
            const data = JSON.parse(payload);
            if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) continue;

            const delta = data.choices[0].delta;
            if (!delta) continue;
            
            if (delta.reasoning_content) {
              fullThinking += delta.reasoning_content;
              onChunk?.(delta.reasoning_content, 'thinking');
            }
            
            if (delta.content) {
              fullContent += delta.content;
              onChunk?.(delta.content, 'content');
            }
          } catch {
            continue;
          }
      }
    }
    return { content: fullContent, thinking: fullThinking };
}

export const generateOptions = async (
    currentStory: string,
    signal?: AbortSignal
  ): Promise<string[]> => {
      try {
          const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
          const config = useAgentConfigStore.getState().getConfig('option_generator');
  
          const messages = [
              { role: 'system', content: config.systemPrompt },
              { role: 'user', content: `当前故事内容：\n${currentStory}\n\n请生成3个选项。` }
          ];
  
          const response = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                  model: config.model,
                  messages,
                  temperature: config.temperature,
                  response_format: { type: 'json_object' },
                  stream: false
              }),
              signal
          });
          
          if (!response.ok) {
              throw new Error(`Option generation failed: ${response.statusText}`);
          }

          const data = await response.json();
          const content = data.choices[0].message.content;
          
          // Log debug info
          useDebugStore.getState().addLog({
              type: 'system',
              agentName: 'Option Generator (选项生成器)',
              request: {
                  model: config.model,
                  systemPrompt: messages[0].content as string,
                  userPrompt: messages[1].content as string,
                  temperature: config.temperature
              },
              response: { content }
          });
  
          const parsed = parseJsonLoose(content);
          if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
              return parsed;
          }
          return ["继续探索", "观察四周", "等待时机"]; // Fallback
      } catch (error) {
          if (isAbortError(error)) throw error;
          console.error('Error generating options:', error);
          return ["继续探索", "观察四周", "等待时机"];
      }
  };
