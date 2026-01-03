import { getEmbeddings, cosineSimilarity, rerankDocuments } from './embedding';
import { v4 as uuidv4 } from 'uuid';

export interface MemorySegment {
  id: string;
  text: string;
  vector: number[];
  metadata: {
    round: number;
    type: 'narrative' | 'summary' | 'character_profile' | 'worldview' | 'outline' | 'story_task';
    timestamp: number;
    entityId?: string; // For linking specific character/task ID to vector segment
  };
}

class MemoryStore {
  private segments: MemorySegment[] = [];

  // Singleton instance
  private static instance: MemoryStore;

  private constructor() {}

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  public async addDocument(text: string, metadata: Omit<MemorySegment['metadata'], 'timestamp'>) {
    // If it's a character profile or task, we don't want to chunk it, we want it whole.
    // For narrative, we might chunk.
    let chunks: string[] = [];
    
    if (metadata.type === 'character_profile' || metadata.type === 'story_task') {
        chunks = [text];
    } else {
        chunks = this.chunkText(text);
    }
    
    if (chunks.length === 0) return;

    try {
      const vectors = await getEmbeddings(chunks);
      
      chunks.forEach((chunk, index) => {
        this.segments.push({
          id: uuidv4(),
          text: chunk,
          vector: vectors[index],
          metadata: {
            ...metadata,
            timestamp: Date.now()
          }
        });
      });
      
      console.log(`[MemoryStore] Added ${chunks.length} segments of type ${metadata.type}.`);
    } catch (error) {
      console.error('[MemoryStore] Failed to add document:', error);
    }
  }
  
  // Update or Replace a document for a specific entity (Character/Task)
  public async updateEntityDocument(entityId: string, text: string, metadata: Omit<MemorySegment['metadata'], 'timestamp' | 'entityId'>) {
      // Remove old segments for this entity
      this.segments = this.segments.filter(s => s.metadata.entityId !== entityId);
      
      // Add new
      await this.addDocument(text, { ...metadata, entityId });
  }

  public getDocumentByEntityId(entityId: string): MemorySegment | undefined {
      return this.segments.find(s => s.metadata.entityId === entityId);
  }

  public async search(query: string, limit: number = 3, useRerank: boolean = true): Promise<{ segment: MemorySegment; score: number }[]> {
    if (this.segments.length === 0) return [];

    try {
      const [queryVector] = await getEmbeddings([query]);
      
      // 1. Initial Retrieval (Cosine Similarity)
      // Get more candidates than limit for reranking (e.g., 3x limit)
      const candidateLimit = useRerank ? Math.max(limit * 5, 10) : limit;
      
      const results = this.segments.map(segment => ({
        segment,
        score: cosineSimilarity(queryVector, segment.vector)
      }));

      const topCandidates = results
        .sort((a, b) => b.score - a.score)
        .slice(0, candidateLimit);

      if (!useRerank || topCandidates.length === 0) {
          return topCandidates.slice(0, limit);
      }

      // 2. Reranking
      const documents = topCandidates.map(c => c.segment.text);
      const rerankResults = await rerankDocuments(query, documents, limit);
      
      // Map rerank results back to segments
      return rerankResults.map(r => ({
          segment: topCandidates[r.index].segment,
          score: r.relevance_score
      })).sort((a, b) => b.score - a.score); // Rerank results are usually sorted, but ensure it.
        
    } catch (error) {
      console.error('[MemoryStore] Search failed:', error);
      return [];
    }
  }

  public clear() {
    this.segments = [];
  }

  public getAllSegments() {
    return this.segments;
  }

  private chunkText(text: string, maxChars: number = 500): string[] {
    // 1. First split by paragraphs (one or more newlines)
    const paragraphs = text.split(/\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const p of paragraphs) {
      const trimmedP = p.trim();
      if (!trimmedP) continue;

      // If a single paragraph is too long, we need to split it further
      if (trimmedP.length > maxChars) {
        // Push current accumulated chunk first if it exists
        if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        
        // Split long paragraph by sentences roughly
        const sentences = trimmedP.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmedP];
        let subChunk = '';
        
        for (const s of sentences) {
             if ((subChunk + s).length > maxChars && subChunk.length > 0) {
                 chunks.push(subChunk.trim());
                 subChunk = '';
             }
             subChunk += s;
        }
        if (subChunk) {
            chunks.push(subChunk.trim());
        }
      } else {
        // Standard accumulation
        if ((currentChunk + '\n' + trimmedP).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += (currentChunk ? '\n' : '') + trimmedP;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // console.log(`[MemoryStore] Chunked text into ${chunks.length} parts (maxChars=${maxChars}).`);
    return chunks;
  }
}

export const memoryStore = MemoryStore.getInstance();
