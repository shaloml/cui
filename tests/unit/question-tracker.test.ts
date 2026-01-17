import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuestionTracker } from '@/services/question-tracker';
import { AskUserQuestionRequest, AskUserQuestionItem } from '@/types';

describe('QuestionTracker', () => {
  let tracker: QuestionTracker;

  const createTestQuestion = (overrides?: Partial<AskUserQuestionItem>): AskUserQuestionItem => ({
    question: 'What is your preferred framework?',
    header: 'Framework',
    options: [
      { label: 'React', description: 'A JavaScript library for building user interfaces' },
      { label: 'Vue', description: 'The Progressive JavaScript Framework' },
    ],
    multiSelect: false,
    ...overrides,
  });

  beforeEach(() => {
    tracker = new QuestionTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  describe('addQuestionRequest', () => {
    it('should add a question request with unique id', () => {
      const questions = [createTestQuestion()];
      const request = tracker.addQuestionRequest(questions, 'stream-123');

      expect(request.id).toBeDefined();
      expect(typeof request.id).toBe('string');
      expect(request.id.length).toBeGreaterThan(0);
    });

    it('should emit question_request event when adding', () => {
      return new Promise<void>((resolve) => {
        const questions = [createTestQuestion()];

        tracker.on('question_request', (request: AskUserQuestionRequest) => {
          expect(request.questions).toEqual(questions);
          expect(request.streamingId).toBe('stream-123');
          resolve();
        });

        tracker.addQuestionRequest(questions, 'stream-123');
      });
    });

    it('should set status to pending for new requests', () => {
      const questions = [createTestQuestion()];
      const request = tracker.addQuestionRequest(questions, 'stream-123');

      expect(request.status).toBe('pending');
    });

    it('should include timestamp', () => {
      const questions = [createTestQuestion()];
      const beforeTime = new Date().toISOString();
      const request = tracker.addQuestionRequest(questions, 'stream-123');
      const afterTime = new Date().toISOString();

      expect(request.timestamp).toBeDefined();
      expect(request.timestamp >= beforeTime).toBe(true);
      expect(request.timestamp <= afterTime).toBe(true);
    });

    it('should use unknown streamingId when not provided', () => {
      const questions = [createTestQuestion()];
      const request = tracker.addQuestionRequest(questions);

      expect(request.streamingId).toBe('unknown');
    });

    it('should store multiple questions', () => {
      const questions = [
        createTestQuestion({ header: 'Framework' }),
        createTestQuestion({ header: 'Package Manager', question: 'Which package manager?' }),
      ];
      const request = tracker.addQuestionRequest(questions, 'stream-123');

      expect(request.questions).toHaveLength(2);
      expect(request.questions[0].header).toBe('Framework');
      expect(request.questions[1].header).toBe('Package Manager');
    });
  });

  describe('getAllQuestionRequests', () => {
    it('should return all question requests', () => {
      tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      tracker.addQuestionRequest([createTestQuestion()], 'stream-2');

      const requests = tracker.getAllQuestionRequests();

      expect(requests).toHaveLength(2);
    });

    it('should return empty array when no questions', () => {
      const requests = tracker.getAllQuestionRequests();
      expect(requests).toEqual([]);
    });
  });

  describe('getQuestionRequests', () => {
    beforeEach(() => {
      // Add some test requests
      const req1 = tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      const req2 = tracker.addQuestionRequest([createTestQuestion()], 'stream-2');
      const req3 = tracker.addQuestionRequest([createTestQuestion()], 'stream-1');

      // Update some statuses
      tracker.updateQuestionAnswer(req1.id, { Framework: 'React' });
    });

    it('should return all questions without filter', () => {
      const requests = tracker.getQuestionRequests();
      expect(requests).toHaveLength(3);
    });

    it('should filter by streamingId', () => {
      const requests = tracker.getQuestionRequests({ streamingId: 'stream-1' });

      expect(requests).toHaveLength(2);
      requests.forEach(req => {
        expect(req.streamingId).toBe('stream-1');
      });
    });

    it('should filter by status (pending)', () => {
      const pendingRequests = tracker.getQuestionRequests({ status: 'pending' });
      expect(pendingRequests).toHaveLength(2);
      pendingRequests.forEach(req => {
        expect(req.status).toBe('pending');
      });
    });

    it('should filter by status (answered)', () => {
      const answeredRequests = tracker.getQuestionRequests({ status: 'answered' });
      expect(answeredRequests).toHaveLength(1);
      expect(answeredRequests[0].status).toBe('answered');
    });

    it('should filter by both streamingId and status', () => {
      const requests = tracker.getQuestionRequests({
        streamingId: 'stream-1',
        status: 'answered',
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].streamingId).toBe('stream-1');
      expect(requests[0].status).toBe('answered');
    });

    it('should return empty array when no questions match filter', () => {
      const requests = tracker.getQuestionRequests({ streamingId: 'non-existent' });
      expect(requests).toEqual([]);
    });
  });

  describe('getQuestionRequest', () => {
    it('should return question by id', () => {
      const added = tracker.addQuestionRequest([createTestQuestion()], 'stream-123');

      const request = tracker.getQuestionRequest(added.id);

      expect(request).toBeDefined();
      expect(request?.id).toBe(added.id);
      expect(request?.streamingId).toBe('stream-123');
    });

    it('should return undefined for non-existent id', () => {
      const request = tracker.getQuestionRequest('non-existent-id');
      expect(request).toBeUndefined();
    });
  });

  describe('updateQuestionAnswer', () => {
    it('should update status to answered', () => {
      const request = tracker.addQuestionRequest([createTestQuestion()], 'stream-123');

      const success = tracker.updateQuestionAnswer(request.id, { Framework: 'React' });

      expect(success).toBe(true);
      const updated = tracker.getQuestionRequest(request.id);
      expect(updated?.status).toBe('answered');
    });

    it('should store answers', () => {
      const request = tracker.addQuestionRequest([createTestQuestion()], 'stream-123');
      const answers = { Framework: 'React', 'Package Manager': 'npm' };

      tracker.updateQuestionAnswer(request.id, answers);

      const updated = tracker.getQuestionRequest(request.id);
      expect(updated?.answers).toEqual(answers);
    });

    it('should emit question_answered event', () => {
      return new Promise<void>((resolve) => {
        const request = tracker.addQuestionRequest([createTestQuestion()], 'stream-123');
        const answers = { Framework: 'Vue' };

        tracker.on('question_answered', (updated: AskUserQuestionRequest) => {
          expect(updated.id).toBe(request.id);
          expect(updated.status).toBe('answered');
          expect(updated.answers).toEqual(answers);
          resolve();
        });

        tracker.updateQuestionAnswer(request.id, answers);
      });
    });

    it('should return true on success', () => {
      const request = tracker.addQuestionRequest([createTestQuestion()], 'stream-123');

      const success = tracker.updateQuestionAnswer(request.id, { Framework: 'React' });

      expect(success).toBe(true);
    });

    it('should return false for non-existent request', () => {
      const success = tracker.updateQuestionAnswer('non-existent', { Framework: 'React' });
      expect(success).toBe(false);
    });
  });

  describe('removeQuestionsByStreamingId', () => {
    beforeEach(() => {
      // Add questions for different streaming IDs
      tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      tracker.addQuestionRequest([createTestQuestion()], 'stream-2');
      tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      tracker.addQuestionRequest([createTestQuestion()], 'stream-3');
    });

    it('should remove all questions for streaming id', () => {
      expect(tracker.size()).toBe(4);

      const removedCount = tracker.removeQuestionsByStreamingId('stream-1');

      expect(removedCount).toBe(2);
      expect(tracker.size()).toBe(2);

      // Verify that only stream-1 questions were removed
      const remaining = tracker.getAllQuestionRequests();
      expect(remaining).toHaveLength(2);
      expect(remaining[0].streamingId).toBe('stream-2');
      expect(remaining[1].streamingId).toBe('stream-3');
    });

    it('should return count of removed items', () => {
      const removedCount = tracker.removeQuestionsByStreamingId('stream-1');
      expect(removedCount).toBe(2);
    });

    it('should not affect other streaming ids', () => {
      tracker.removeQuestionsByStreamingId('stream-1');

      const stream2Questions = tracker.getQuestionRequests({ streamingId: 'stream-2' });
      const stream3Questions = tracker.getQuestionRequests({ streamingId: 'stream-3' });

      expect(stream2Questions).toHaveLength(1);
      expect(stream3Questions).toHaveLength(1);
    });

    it('should return 0 when no questions match the streaming id', () => {
      const removedCount = tracker.removeQuestionsByStreamingId('non-existent-stream');

      expect(removedCount).toBe(0);
      expect(tracker.size()).toBe(4);
    });

    it('should handle removing from empty tracker', () => {
      tracker.clear();

      const removedCount = tracker.removeQuestionsByStreamingId('stream-1');

      expect(removedCount).toBe(0);
      expect(tracker.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all questions', () => {
      tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      tracker.addQuestionRequest([createTestQuestion()], 'stream-2');

      expect(tracker.size()).toBe(2);

      tracker.clear();

      expect(tracker.size()).toBe(0);
      expect(tracker.getAllQuestionRequests()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return the number of question requests', () => {
      expect(tracker.size()).toBe(0);

      tracker.addQuestionRequest([createTestQuestion()], 'stream-1');
      expect(tracker.size()).toBe(1);

      tracker.addQuestionRequest([createTestQuestion()], 'stream-2');
      expect(tracker.size()).toBe(2);
    });
  });
});
