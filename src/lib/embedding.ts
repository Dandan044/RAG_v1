import axios from 'axios';

const EMBEDDING_CONFIG = {
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: "sk-hhqbvbwvlwoalronwbdgtbemvgrdftmlfauiateivbpsqoxz",
  model: "BAAI/bge-m3",
  dimensions: 1024,
  encoding_format: "float"
};

const RERANK_CONFIG = {
  baseURL: "https://api.siliconflow.cn/v1",
  apiKey: "sk-hhqbvbwvlwoalronwbdgtbemvgrdftmlfauiateivbpsqoxz",
  model: "BAAI/bge-reranker-v2-m3"
};

type EmbeddingResponseItem = {
  index: number;
  embedding: number[];
};

type EmbeddingResponseData = {
  data: EmbeddingResponseItem[];
};

type RerankResponseItem = {
    index: number;
    relevance_score: number;
    document?: { text: string }; // Depending on return_documents=true
};

type RerankResponseData = {
    results: RerankResponseItem[];
};

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  try {
    const response = await axios.post<EmbeddingResponseData>(
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
      const sortedData = response.data.data.sort((a, b) => a.index - b.index);
      return sortedData.map((item) => item.embedding);
    }
    
    throw new Error('Invalid response format from embedding API');
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    throw error;
  }
};

export const rerankDocuments = async (query: string, documents: string[], topN: number = 5): Promise<{ index: number; relevance_score: number }[]> => {
    try {
        const response = await axios.post<RerankResponseData>(
            `${RERANK_CONFIG.baseURL}/rerank`,
            {
                model: RERANK_CONFIG.model,
                query: query,
                documents: documents,
                top_n: topN,
                return_documents: false, // We only need indices and scores
                max_chunks_per_doc: 1024,
                overlap_tokens: 80
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RERANK_CONFIG.apiKey}`
                }
            }
        );

        if (response.data && response.data.results) {
            return response.data.results;
        }

        throw new Error('Invalid response format from rerank API');
    } catch (error) {
        console.error('Error reranking documents:', error);
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
