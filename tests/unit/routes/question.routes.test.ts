import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createQuestionRoutes } from '@/routes/question.routes';
import { QuestionTracker } from '@/services/question-tracker';

vi.mock('@/services/logger.js');

describe('Question Routes', () => {
  let app: express.Application;
  let questionTracker: vi.Mocked<QuestionTracker>;

  const createTestQuestion = () => ({
    question: 'What is your preferred framework?',
    header: 'Framework',
    options: [
      { label: 'React', description: 'A JavaScript library' },
      { label: 'Vue', description: 'The Progressive JavaScript Framework' },
    ],
    multiSelect: false,
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());

    questionTracker = {
      addQuestionRequest: vi.fn(),
      getQuestionRequests: vi.fn(),
      getQuestionRequest: vi.fn(),
      updateQuestionAnswer: vi.fn(),
      getAllQuestionRequests: vi.fn(),
      clear: vi.fn(),
      size: vi.fn(),
      removeQuestionsByStreamingId: vi.fn(),
    } as any;

    app.use('/api/questions', createQuestionRoutes(questionTracker));

    // Add error handling middleware
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  describe('POST /api/questions/notify', () => {
    it('should create question request and return id', async () => {
      const questions = [createTestQuestion()];
      const questionRequest = {
        id: 'generated-id',
        streamingId: 'test-streaming-id',
        questions,
        timestamp: new Date().toISOString(),
        status: 'pending' as const,
      };

      questionTracker.addQuestionRequest.mockReturnValue(questionRequest);

      const response = await request(app)
        .post('/api/questions/notify')
        .send({
          questions,
          streamingId: 'test-streaming-id',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        id: 'generated-id',
      });

      expect(questionTracker.addQuestionRequest).toHaveBeenCalledWith(
        questions,
        'test-streaming-id'
      );
    });

    it('should return 400 when questions array is missing', async () => {
      const response = await request(app)
        .post('/api/questions/notify')
        .send({
          streamingId: 'test-streaming-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('questions array is required');
    });

    it('should return 400 when questions array is empty', async () => {
      const response = await request(app)
        .post('/api/questions/notify')
        .send({
          questions: [],
          streamingId: 'test-streaming-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('questions array is required');
    });

    it('should return 400 when questions is not an array', async () => {
      const response = await request(app)
        .post('/api/questions/notify')
        .send({
          questions: 'not an array',
          streamingId: 'test-streaming-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('questions array is required');
    });
  });

  describe('GET /api/questions', () => {
    it('should return all questions without filter', async () => {
      const questions = [
        {
          id: 'id1',
          streamingId: 'stream1',
          questions: [createTestQuestion()],
          timestamp: new Date().toISOString(),
          status: 'pending' as const,
        },
        {
          id: 'id2',
          streamingId: 'stream2',
          questions: [createTestQuestion()],
          timestamp: new Date().toISOString(),
          status: 'answered' as const,
          answers: { Framework: 'React' },
        },
      ];

      questionTracker.getQuestionRequests.mockReturnValue(questions);

      const response = await request(app)
        .get('/api/questions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ questions });
      expect(questionTracker.getQuestionRequests).toHaveBeenCalledWith({
        streamingId: undefined,
        status: undefined,
      });
    });

    it('should filter by streamingId', async () => {
      const questions = [
        {
          id: 'id1',
          streamingId: 'stream1',
          questions: [createTestQuestion()],
          timestamp: new Date().toISOString(),
          status: 'pending' as const,
        },
      ];

      questionTracker.getQuestionRequests.mockReturnValue(questions);

      const response = await request(app)
        .get('/api/questions?streamingId=stream1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ questions });
      expect(questionTracker.getQuestionRequests).toHaveBeenCalledWith({
        streamingId: 'stream1',
        status: undefined,
      });
    });

    it('should filter by status', async () => {
      const questions = [
        {
          id: 'id1',
          streamingId: 'stream1',
          questions: [createTestQuestion()],
          timestamp: new Date().toISOString(),
          status: 'pending' as const,
        },
      ];

      questionTracker.getQuestionRequests.mockReturnValue(questions);

      const response = await request(app)
        .get('/api/questions?status=pending');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ questions });
      expect(questionTracker.getQuestionRequests).toHaveBeenCalledWith({
        streamingId: undefined,
        status: 'pending',
      });
    });

    it('should filter by both streamingId and status', async () => {
      const questions = [
        {
          id: 'id1',
          streamingId: 'stream1',
          questions: [createTestQuestion()],
          timestamp: new Date().toISOString(),
          status: 'pending' as const,
        },
      ];

      questionTracker.getQuestionRequests.mockReturnValue(questions);

      const response = await request(app)
        .get('/api/questions?streamingId=stream1&status=pending');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ questions });
      expect(questionTracker.getQuestionRequests).toHaveBeenCalledWith({
        streamingId: 'stream1',
        status: 'pending',
      });
    });
  });

  describe('POST /api/questions/:requestId/answer', () => {
    it('should accept answer and return success', async () => {
      const requestId = 'test-request-id';
      const pendingQuestion = {
        id: requestId,
        streamingId: 'test-streaming-id',
        questions: [createTestQuestion()],
        timestamp: new Date().toISOString(),
        status: 'pending' as const,
      };

      questionTracker.getQuestionRequests.mockReturnValue([pendingQuestion]);
      questionTracker.updateQuestionAnswer.mockReturnValue(true);

      const response = await request(app)
        .post(`/api/questions/${requestId}/answer`)
        .send({
          answers: { Framework: 'React' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Question answered successfully',
      });

      expect(questionTracker.getQuestionRequests).toHaveBeenCalledWith({ status: 'pending' });
      expect(questionTracker.updateQuestionAnswer).toHaveBeenCalledWith(
        requestId,
        { Framework: 'React' }
      );
    });

    it('should return 400 when answers object is missing', async () => {
      const response = await request(app)
        .post('/api/questions/test-id/answer')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('answers object is required');
    });

    it('should return 400 when answers is not an object', async () => {
      const response = await request(app)
        .post('/api/questions/test-id/answer')
        .send({
          answers: 'not an object',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('answers object is required');
    });

    it('should return 404 for non-existent question', async () => {
      questionTracker.getQuestionRequests.mockReturnValue([]);

      const response = await request(app)
        .post('/api/questions/non-existent-id/answer')
        .send({
          answers: { Framework: 'React' },
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Question request not found or already answered');
    });

    it('should return 404 for already answered question', async () => {
      const requestId = 'test-request-id';
      // getQuestionRequests with status: 'pending' returns empty - the question is already answered
      questionTracker.getQuestionRequests.mockReturnValue([]);

      const response = await request(app)
        .post(`/api/questions/${requestId}/answer`)
        .send({
          answers: { Framework: 'Vue' },
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Question request not found or already answered');
    });

    it('should handle multiple answers', async () => {
      const requestId = 'test-request-id';
      const pendingQuestion = {
        id: requestId,
        streamingId: 'test-streaming-id',
        questions: [
          createTestQuestion(),
          { ...createTestQuestion(), header: 'Package Manager' },
        ],
        timestamp: new Date().toISOString(),
        status: 'pending' as const,
      };

      questionTracker.getQuestionRequests.mockReturnValue([pendingQuestion]);
      questionTracker.updateQuestionAnswer.mockReturnValue(true);

      const answers = {
        Framework: 'React',
        'Package Manager': 'npm',
      };

      const response = await request(app)
        .post(`/api/questions/${requestId}/answer`)
        .send({ answers });

      expect(response.status).toBe(200);
      expect(questionTracker.updateQuestionAnswer).toHaveBeenCalledWith(requestId, answers);
    });
  });
});
