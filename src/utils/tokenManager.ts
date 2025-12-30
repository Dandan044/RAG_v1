// Simple estimation: 1 token ~= 1.5 - 2 chars for Chinese/English mixed content
// DeepSeek V3/V3.2 supports up to 64k tokens context.
// However, to ensure stable performance and leave room for output generation (8k limit),
// we set a safe input context limit.
// 60,000 tokens * 1.5 chars/token = ~90,000 chars
export const MAX_CONTEXT_TOKENS = 60000; 
const CHARS_PER_TOKEN = 1.5;

export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
};

export const shouldSummarize = (currentContext: string, newContentEstimate: number = 2000): boolean => {
  const currentTokens = estimateTokens(currentContext);
  return (currentTokens + newContentEstimate) > MAX_CONTEXT_TOKENS;
};
