import { getEmbeddings, cosineSimilarity } from './embedding';
import { v4 as uuidv4 } from 'uuid';

export interface MemorySegment {
  id: string;
  text: string;
  vector: number[];
  metadata: {
    round: number;
    type: 'narrative' | 'summary' | 'character_profile' | 'worldview' | 'outline';
    timestamp: number;
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
    // Simple chunking strategy: split by paragraphs, then group if too small
    // For now, let's treat the incoming text as a coherent chunk (e.g. a finalized chapter or segment)
    // If it's too long, we might want to split it.
    
    const chunks = this.chunkText(text);
    
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
      
      console.log(`[MemoryStore] Added ${chunks.length} segments.`);
    } catch (error) {
      console.error('[MemoryStore] Failed to add document:', error);
    }
  }

  public async search(query: string, limit: number = 3): Promise<{ segment: MemorySegment; score: number }[]> {
    if (this.segments.length === 0) return [];

    try {
      const [queryVector] = await getEmbeddings([query]);
      
      const results = this.segments.map(segment => ({
        segment,
        score: cosineSimilarity(queryVector, segment.vector)
      }));

      // Sort by score descending
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
        
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

    console.log(`[MemoryStore] Chunked text into ${chunks.length} parts (maxChars=${maxChars}). Samples:`, chunks.slice(0, 2));
    return chunks;
  }
}

export const memoryStore = MemoryStore.getInstance();
