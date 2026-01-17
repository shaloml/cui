import { Router } from 'express';
import { CUIError, QuestionAnswerRequest, QuestionAnswerResponse } from '@/types/index.js';
import { RequestWithRequestId } from '@/types/express.js';
import { QuestionTracker } from '@/services/question-tracker.js';
import { createLogger } from '@/services/logger.js';

export function createQuestionRoutes(
  questionTracker: QuestionTracker
): Router {
  const router = Router();
  const logger = createLogger('QuestionRoutes');

  // Notify endpoint - called by MCP server when a question is requested
  router.post('/notify', async (req: RequestWithRequestId, res, next) => {
    const requestId = req.requestId;
    logger.debug('Question notification received', {
      requestId,
      body: req.body
    });

    try {
      const { questions, streamingId } = req.body;

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        throw new CUIError('MISSING_QUESTIONS', 'questions array is required', 400);
      }

      // Add question request with the provided streamingId
      const request = questionTracker.addQuestionRequest(questions, streamingId);

      logger.debug('Question request tracked', {
        requestId,
        questionId: request.id,
        questionCount: questions.length,
        streamingId: request.streamingId
      });

      res.json({ success: true, id: request.id });
    } catch (error) {
      logger.debug('Question notification failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // List questions
  router.get('/', async (req: RequestWithRequestId, res, next) => {
    const requestId = req.requestId;
    logger.debug('List questions request', {
      requestId,
      query: req.query
    });

    try {
      const { streamingId, status } = req.query as { streamingId?: string; status?: 'pending' | 'answered' };

      const questions = questionTracker.getQuestionRequests({ streamingId, status });

      logger.debug('Questions listed successfully', {
        requestId,
        count: questions.length,
        filter: { streamingId, status }
      });

      res.json({ questions });
    } catch (error) {
      logger.debug('List questions failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Answer question endpoint - called by frontend to submit answers
  router.post('/:requestId/answer', async (req: RequestWithRequestId, res, next) => {
    const requestIdHeader = req.requestId;
    const { requestId } = req.params;
    const answerRequest: QuestionAnswerRequest = req.body;

    logger.debug('Question answer request', {
      requestId: requestIdHeader,
      questionRequestId: requestId,
      answer: answerRequest
    });

    try {
      // Validate request body
      if (!answerRequest.answers || typeof answerRequest.answers !== 'object') {
        throw new CUIError('INVALID_ANSWERS', 'answers object is required', 400);
      }

      // Get the question request to validate it exists and is pending
      const questions = questionTracker.getQuestionRequests({ status: 'pending' });
      const question = questions.find(q => q.id === requestId);

      if (!question) {
        throw new CUIError('QUESTION_NOT_FOUND', 'Question request not found or already answered', 404);
      }

      // Update question with answers
      const updated = questionTracker.updateQuestionAnswer(requestId, answerRequest.answers);

      if (!updated) {
        throw new CUIError('UPDATE_FAILED', 'Failed to update question with answers', 500);
      }

      logger.debug('Question answered successfully', {
        requestId: requestIdHeader,
        questionRequestId: requestId,
        answers: answerRequest.answers
      });

      const response: QuestionAnswerResponse = {
        success: true,
        message: 'Question answered successfully'
      };

      res.json(response);
    } catch (error) {
      logger.debug('Question answer failed', {
        requestId: requestIdHeader,
        questionRequestId: requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  return router;
}
