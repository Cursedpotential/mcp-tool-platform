/**
 * Conversation Segmentation Module
 * 
 * Detects topic changes within a single platform's message stream and assigns
 * cluster IDs to group related messages into conversations.
 * 
 * Cluster ID Format: PLAT_YYMM_TOPIC_iii
 * Example: SMS_2401_KAILAH_001
 */

import { execSync } from 'child_process';

// Platform code mapping
export const PLATFORM_CODES: Record<string, string> = {
  'sms': 'SMS',
  'imessage': 'IMSG',
  'facebook': 'FB',
  'messenger': 'FB',
  'email': 'MAIL',
  'chatgpt': 'CHAT',
  'whatsapp': 'WA',
  'discord': 'DISC',
  'snapchat': 'SNAP',
};

// Topic code mapping (6 chars max)
export const TOPIC_CODES: Record<string, string> = {
  'kailah': 'KAILAH',
  'daughter': 'KAILAH',
  'child': 'KAILAH',
  'baby': 'KAILAH',
  'kid': 'KAILAH',
  'visits': 'VISITS',
  'visitation': 'VISITS',
  'parenting time': 'VISITS',
  'custody': 'VISITS',
  'calls': 'CALLS',
  'phone': 'CALLS',
  'call': 'CALLS',
  'school': 'SCHOOL',
  'education': 'SCHOOL',
  'teacher': 'SCHOOL',
  'money': 'MONEY',
  'financial': 'MONEY',
  'bills': 'MONEY',
  'rent': 'MONEY',
  'health': 'HEALTH',
  'medical': 'HEALTH',
  'doctor': 'HEALTH',
  'hospital': 'HEALTH',
  'substance': 'SUBST',
  'alcohol': 'SUBST',
  'drugs': 'SUBST',
  'adderall': 'SUBST',
  'infidelity': 'INFID',
  'cheating': 'INFID',
  'affair': 'INFID',
  'threat': 'THREAT',
  'threaten': 'THREAT',
  'hurt': 'THREAT',
  'kill': 'THREAT',
};

export interface Message {
  id: string;
  text: string;
  timestamp: Date;
  sender: string;
  platform: string;
}

export interface ConversationCluster {
  cluster_id: string;
  platform: string;
  topic: string;
  date_range: [Date, Date];
  message_ids: string[];
  message_count: number;
}

export interface SegmentationResult {
  message_id: string;
  cluster_id: string;
  topic: string;
  similarity_to_previous: number;
  is_new_cluster: boolean;
  reason: 'time_gap' | 'topic_change' | 'entity_change' | 'first_message';
}

export class ConversationSegmenter {
  private similarityThreshold = 0.6; // Below this = new topic
  private timeGapThreshold = 2 * 60 * 60 * 1000; // 2 hours in ms
  private clusterCounters: Map<string, number> = new Map(); // Track sequence numbers per platform+month

  /**
   * Segment messages into conversation clusters
   */
  async segmentMessages(messages: Message[]): Promise<SegmentationResult[]> {
    if (messages.length === 0) return [];

    // Sort by timestamp
    const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const results: SegmentationResult[] = [];
    let currentClusterId: string | null = null;
    let previousEmbedding: number[] | null = null;
    let previousTimestamp: Date | null = null;
    let previousTopic: string | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const msg = sorted[i];
      const embedding = await this.getEmbedding(msg.text);
      const topic = this.extractTopic(msg.text);
      
      let isNewCluster = false;
      let reason: SegmentationResult['reason'] = 'first_message';
      let similarity = 1.0;

      if (i === 0) {
        // First message
        isNewCluster = true;
        reason = 'first_message';
      } else {
        // Check time gap
        const timeDiff = msg.timestamp.getTime() - previousTimestamp!.getTime();
        if (timeDiff > this.timeGapThreshold) {
          isNewCluster = true;
          reason = 'time_gap';
        }
        
        // Check semantic similarity
        if (!isNewCluster && previousEmbedding) {
          similarity = this.cosineSimilarity(embedding, previousEmbedding);
          if (similarity < this.similarityThreshold) {
            isNewCluster = true;
            reason = 'topic_change';
          }
        }
        
        // Check entity/topic change
        if (!isNewCluster && topic !== previousTopic) {
          isNewCluster = true;
          reason = 'entity_change';
        }
      }

      // Generate new cluster ID if needed
      if (isNewCluster) {
        currentClusterId = this.generateClusterId(msg.platform, msg.timestamp, topic);
      }

      results.push({
        message_id: msg.id,
        cluster_id: currentClusterId!,
        topic,
        similarity_to_previous: similarity,
        is_new_cluster: isNewCluster,
        reason,
      });

      previousEmbedding = embedding;
      previousTimestamp = msg.timestamp;
      previousTopic = topic;
    }

    return results;
  }

  /**
   * Generate cluster ID: PLAT_YYMM_TOPIC_iii
   */
  private generateClusterId(platform: string, timestamp: Date, topic: string): string {
    const platCode = PLATFORM_CODES[platform.toLowerCase()] || 'UNK';
    const yymm = this.formatYYMM(timestamp);
    const topicCode = topic.toUpperCase().substring(0, 6).padEnd(6, 'X');
    
    // Get sequence number for this platform+month combination
    const key = `${platCode}_${yymm}`;
    const seq = (this.clusterCounters.get(key) || 0) + 1;
    this.clusterCounters.set(key, seq);
    
    const seqStr = seq.toString().padStart(3, '0');
    
    return `${platCode}_${yymm}_${topicCode}_${seqStr}`;
  }

  /**
   * Format date as YYMM
   */
  private formatYYMM(date: Date): string {
    const yy = date.getFullYear().toString().substring(2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${yy}${mm}`;
  }

  /**
   * Extract topic from message text
   */
  private extractTopic(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Check for topic keywords
    for (const [keyword, code] of Object.entries(TOPIC_CODES)) {
      if (lowerText.includes(keyword)) {
        return code;
      }
    }
    
    // Default to GENRL (general)
    return 'GENRL';
  }

  /**
   * Get embedding for text using Python sentence-transformers
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      // Call Python script to get embedding
      const result = execSync(
        `python3 /home/ubuntu/mcp-tool-platform/server/python-tools/get_embedding.py "${text.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      return JSON.parse(result);
    } catch (error) {
      console.error('Error getting embedding:', error);
      // Return zero vector as fallback
      return new Array(384).fill(0);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  /**
   * Group segmentation results into clusters
   */
  groupIntoClusters(results: SegmentationResult[], messages: Message[]): ConversationCluster[] {
    const clusters = new Map<string, ConversationCluster>();
    
    for (const result of results) {
      const msg = messages.find(m => m.id === result.message_id);
      if (!msg) continue;
      
      if (!clusters.has(result.cluster_id)) {
        clusters.set(result.cluster_id, {
          cluster_id: result.cluster_id,
          platform: msg.platform,
          topic: result.topic,
          date_range: [msg.timestamp, msg.timestamp],
          message_ids: [],
          message_count: 0,
        });
      }
      
      const cluster = clusters.get(result.cluster_id)!;
      cluster.message_ids.push(msg.id);
      cluster.message_count++;
      
      // Update date range
      if (msg.timestamp < cluster.date_range[0]) {
        cluster.date_range[0] = msg.timestamp;
      }
      if (msg.timestamp > cluster.date_range[1]) {
        cluster.date_range[1] = msg.timestamp;
      }
    }
    
    return Array.from(clusters.values());
  }
}

/**
 * Convenience function for single-platform segmentation
 */
export async function segmentConversations(messages: Message[]): Promise<{
  results: SegmentationResult[];
  clusters: ConversationCluster[];
}> {
  const segmenter = new ConversationSegmenter();
  const results = await segmenter.segmentMessages(messages);
  const clusters = segmenter.groupIntoClusters(results, messages);
  
  return { results, clusters };
}
