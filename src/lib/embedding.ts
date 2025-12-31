import axios from 'axios';

const EMBEDDING_CONFIG = {
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: "sk-hhqbvbwvlwoalronwbdgtbemvgrdftmlfauiateivbpsqoxz",
  model: "BAAI/bge-m3",
  dimensions: 1024,
  encoding_format: "float"
};

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  try {
    const response = await axios.post(
      `${EMBEDDING_CONFIG.baseURL}/embeddings`,
      {
        model: EMBEDDING_CONFIG.model,
        input: texts,
        encoding_format: EMBEDDING_CONFIG.encoding_format,
        dimensions: EMBEDDING_CONFIG.dimensions // Optional but recommended by user prompt
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMBEDDING_CONFIG.apiKey}`
        }
      }
    );

    if (response.data && response.data.data) {
      // Sort by index to ensure order matches input
      const sortedData = response.data.data.sort((a: any, b: any) => a.index - b.index);
      return sortedData.map((item: any) => item.embedding);
    }
    
    throw new Error('Invalid response format from embedding API');
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    throw error;
  }
};

// Utility for cosine similarity
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
