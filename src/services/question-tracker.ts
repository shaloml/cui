import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AskUserQuestionRequest, AskUserQuestionItem } from '@/types/index.js';
import { logger } from '@/services/logger.js';

/**
 * Service to track question requests from Claude CLI via MCP
 */
export class QuestionTracker extends EventEmitter {
  private questionRequests: Map<string, AskUserQuestionRequest> = new Map();

  constructor() {
    super();
  }

  /**
   * Add a new question request
   */
  addQuestionRequest(questions: AskUserQuestionItem[], streamingId?: string): AskUserQuestionRequest {
    const id = uuidv4();
    const request: AskUserQuestionRequest = {
      id,
      streamingId: streamingId || 'unknown',
      questions,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    this.questionRequests.set(id, request);
    logger.info('Question request added', { id, questionCount: questions.length, streamingId });

    // Emit event for new question request
    this.emit('question_request', request);

    return request;
  }

  /**
   * Get all question requests
   */
  getAllQuestionRequests(): AskUserQuestionRequest[] {
    return Array.from(this.questionRequests.values());
  }

  /**
   * Get question requests filtered by criteria
   */
  getQuestionRequests(filter?: { streamingId?: string; status?: 'pending' | 'answered' }): AskUserQuestionRequest[] {
    let requests = Array.from(this.questionRequests.values());

    if (filter?.streamingId) {
      requests = requests.filter(req => req.streamingId === filter.streamingId);
    }

    if (filter?.status) {
      requests = requests.filter(req => req.status === filter.status);
    }

    return requests;
  }

  /**
   * Get a specific question request by ID
   */
  getQuestionRequest(id: string): AskUserQuestionRequest | undefined {
    return this.questionRequests.get(id);
  }

  /**
   * Update question request with answers
   */
  updateQuestionAnswer(id: string, answers: Record<string, string>): boolean {
    const request = this.questionRequests.get(id);
    if (!request) {
      logger.warn('Question request not found', { id });
      return false;
    }

    request.status = 'answered';
    request.answers = answers;

    logger.info('Question request answered', { id, answers });
    this.emit('question_answered', request);

    return true;
  }

  /**
   * Clear all question requests (for testing)
   */
  clear(): void {
    this.questionRequests.clear();
  }

  /**
   * Get the number of question requests
   */
  size(): number {
    return this.questionRequests.size;
  }

  /**
   * Remove all questions for a specific streaming ID
   * Used for cleanup when a conversation ends
   */
  removeQuestionsByStreamingId(streamingId: string): number {
    const toRemove: string[] = [];

    // Find all questions with this streamingId
    for (const [id, request] of this.questionRequests.entries()) {
      if (request.streamingId === streamingId) {
        toRemove.push(id);
      }
    }

    // Remove them
    toRemove.forEach(id => this.questionRequests.delete(id));

    if (toRemove.length > 0) {
      logger.info('Removed questions for streaming session', {
        streamingId,
        removedCount: toRemove.length
      });
    }

    return toRemove.length;
  }
}
