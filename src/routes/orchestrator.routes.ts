import { Router, Request, Response } from 'express';
import {
  StartOrchestratorRequest,
  StartOrchestratorResponse,
  OrchestratorMessageRequest,
  OrchestratorInjectRequest,
  OrchestratorInjectResponse,
  CUIError
} from '@/types/index.js';
import { RequestWithRequestId } from '@/types/express.js';
import { OrchestratorService } from '@/services/orchestrator-service.js';
import { StreamManager } from '@/services/stream-manager.js';
import { createLogger } from '@/services/logger.js';

export function createOrchestratorRoutes(
  orchestratorService: OrchestratorService,
  streamManager: StreamManager
): Router {
  const router = Router();
  const logger = createLogger('OrchestratorRoutes');

  // Start a new orchestrator session
  router.post(
    '/start',
    async (
      req: Request<Record<string, never>, StartOrchestratorResponse, StartOrchestratorRequest> & RequestWithRequestId,
      res: Response<StartOrchestratorResponse>,
      next
    ) => {
      const requestId = req.requestId;
      const { mainSessionId, workingDirectory } = req.body;

      logger.debug('Start orchestrator request', {
        requestId,
        mainSessionId,
        workingDirectory
      });

      try {
        // Validate required fields
        if (!mainSessionId) {
          throw new CUIError('MISSING_MAIN_SESSION_ID', 'mainSessionId is required', 400);
        }
        if (!workingDirectory) {
          throw new CUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
        }

        // Check if there's already an active orchestrator for this main session
        const existingSessions = orchestratorService.getSessionsForMain(mainSessionId);
        const activeSession = existingSessions.find(s => s.status !== 'stopped');

        if (activeSession) {
          logger.debug('Returning existing orchestrator session', {
            requestId,
            orchestratorId: activeSession.orchestratorId
          });

          res.json({
            orchestratorId: activeSession.orchestratorId,
            streamingId: activeSession.streamingId,
            streamUrl: `/api/orchestrator/${activeSession.orchestratorId}/stream`,
            status: 'ready'
          });
          return;
        }

        // Start new orchestrator session
        const session = await orchestratorService.startOrchestrator(
          mainSessionId,
          workingDirectory
        );

        logger.info('Orchestrator session started', {
          requestId,
          orchestratorId: session.orchestratorId,
          streamingId: session.streamingId
        });

        res.json({
          orchestratorId: session.orchestratorId,
          streamingId: session.streamingId,
          streamUrl: `/api/orchestrator/${session.orchestratorId}/stream`,
          status: 'ready'
        });
      } catch (error) {
        logger.debug('Start orchestrator failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Send a message to an orchestrator
  router.post(
    '/:orchestratorId/message',
    async (
      req: Request<{ orchestratorId: string }, { success: boolean }, OrchestratorMessageRequest> & RequestWithRequestId,
      res: Response<{ success: boolean }>,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;
      const { prompt } = req.body;

      logger.debug('Send orchestrator message request', {
        requestId,
        orchestratorId,
        promptLength: prompt?.length
      });

      try {
        // Validate required fields
        if (!prompt) {
          throw new CUIError('MISSING_PROMPT', 'prompt is required', 400);
        }

        // Check if orchestrator exists
        const session = orchestratorService.getSession(orchestratorId);
        if (!session) {
          throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
        }

        // Send message
        await orchestratorService.sendMessage(orchestratorId, prompt);

        logger.debug('Message sent to orchestrator', {
          requestId,
          orchestratorId
        });

        res.json({ success: true });
      } catch (error) {
        logger.debug('Send orchestrator message failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Inject text into main conversation composer
  router.post(
    '/:orchestratorId/inject',
    async (
      req: Request<{ orchestratorId: string }, OrchestratorInjectResponse, OrchestratorInjectRequest> & RequestWithRequestId,
      res: Response<OrchestratorInjectResponse>,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;
      const { text } = req.body;

      logger.debug('Inject to main request', {
        requestId,
        orchestratorId,
        textLength: text?.length
      });

      try {
        // Validate required fields
        if (!text) {
          throw new CUIError('MISSING_TEXT', 'text is required', 400);
        }

        // Check if orchestrator exists
        const session = orchestratorService.getSession(orchestratorId);
        if (!session) {
          throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
        }

        // Inject text
        orchestratorService.injectToMain(orchestratorId, text);

        // Also broadcast the injection event to the orchestrator's stream
        // so frontend can react to it
        // Note: This is an extension event not in the standard StreamEvent type
        streamManager.broadcast(session.streamingId, {
          type: 'orchestrator_inject',
          text,
          mainSessionId: session.mainSessionId,
          timestamp: new Date().toISOString()
        } as unknown as import('@/types/index.js').StreamEvent);

        logger.debug('Text injected to main conversation', {
          requestId,
          orchestratorId,
          mainSessionId: session.mainSessionId
        });

        res.json({ success: true });
      } catch (error) {
        logger.debug('Inject to main failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Stream orchestrator events (SSE endpoint)
  router.get(
    '/:orchestratorId/stream',
    async (
      req: Request<{ orchestratorId: string }> & RequestWithRequestId,
      res: Response,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;

      logger.debug('Orchestrator stream connection request', {
        requestId,
        orchestratorId
      });

      try {
        // Check if orchestrator exists
        const session = orchestratorService.getSession(orchestratorId);
        if (!session) {
          throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
        }

        // Add client to stream manager using the orchestrator's streaming ID
        streamManager.addClient(session.streamingId, res);

        logger.debug('Client connected to orchestrator stream', {
          requestId,
          orchestratorId,
          streamingId: session.streamingId
        });
      } catch (error) {
        logger.debug('Orchestrator stream connection failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Refresh orchestrator context with latest main conversation
  router.post(
    '/:orchestratorId/refresh',
    async (
      req: Request<{ orchestratorId: string }> & RequestWithRequestId,
      res: Response<{ success: boolean }>,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;

      logger.debug('Refresh orchestrator context request', {
        requestId,
        orchestratorId
      });

      try {
        await orchestratorService.refreshContext(orchestratorId);

        logger.debug('Orchestrator context refreshed', {
          requestId,
          orchestratorId
        });

        res.json({ success: true });
      } catch (error) {
        logger.debug('Refresh orchestrator context failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Stop an orchestrator session
  router.post(
    '/:orchestratorId/stop',
    async (
      req: Request<{ orchestratorId: string }> & RequestWithRequestId,
      res: Response<{ success: boolean }>,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;

      logger.debug('Stop orchestrator request', {
        requestId,
        orchestratorId
      });

      try {
        const success = await orchestratorService.stopOrchestrator(orchestratorId);

        logger.info('Orchestrator stopped', {
          requestId,
          orchestratorId,
          success
        });

        res.json({ success });
      } catch (error) {
        logger.debug('Stop orchestrator failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  // Get orchestrator session info
  router.get(
    '/:orchestratorId',
    async (
      req: Request<{ orchestratorId: string }> & RequestWithRequestId,
      res: Response,
      next
    ) => {
      const requestId = req.requestId;
      const { orchestratorId } = req.params;

      logger.debug('Get orchestrator info request', {
        requestId,
        orchestratorId
      });

      try {
        const session = orchestratorService.getSession(orchestratorId);
        if (!session) {
          throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
        }

        res.json(session);
      } catch (error) {
        logger.debug('Get orchestrator info failed', {
          requestId,
          orchestratorId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    }
  );

  return router;
}
