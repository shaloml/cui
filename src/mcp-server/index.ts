#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { logger } from '@/services/logger.js';

// Type definitions
interface PermissionNotificationResponse {
  success: boolean;
  id: string;
}

interface Permission {
  id: string;
  status: 'pending' | 'approved' | 'denied';
  modifiedInput?: Record<string, unknown>;
  denyReason?: string;
}

interface PermissionsResponse {
  permissions: Permission[];
}

interface QuestionNotificationResponse {
  success: boolean;
  id: string;
}

interface QuestionRequest {
  id: string;
  status: 'pending' | 'answered';
  answers?: Record<string, string>;
}

interface QuestionsResponse {
  questions: QuestionRequest[];
}

// Get CUI server URL from environment
const CUI_SERVER_URL = process.env.CUI_SERVER_URL || `http://localhost:${process.env.CUI_SERVER_PORT || '3001'}`;

// Get CUI streaming ID from environment (passed by ClaudeProcessManager)
const CUI_STREAMING_ID = process.env.CUI_STREAMING_ID;

// Create MCP server
const server = new Server({
  name: 'cui-permissions',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define the approval_prompt and ask_user_question tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'approval_prompt',
      description: 'Request approval for tool usage from CUI',
      inputSchema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'The tool requesting permission',
          },
          input: {
            type: 'object',
            description: 'The input for the tool',
          },
        },
        required: ['tool_name', 'input'],
      },
    },
    {
      name: 'ask_user_question',
      description: 'Ask the user a question with multiple choice options',
      inputSchema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'Array of questions to ask the user',
            items: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'The question text to display',
                },
                header: {
                  type: 'string',
                  description: 'Short label for the question (max 12 chars)',
                },
                options: {
                  type: 'array',
                  description: 'Available choices for this question',
                  items: {
                    type: 'object',
                    properties: {
                      label: {
                        type: 'string',
                        description: 'Display text for this option',
                      },
                      description: {
                        type: 'string',
                        description: 'Optional explanation of what this option means',
                      },
                    },
                    required: ['label'],
                  },
                },
                multiSelect: {
                  type: 'boolean',
                  description: 'Whether multiple options can be selected',
                  default: false,
                },
              },
              required: ['question', 'header', 'options', 'multiSelect'],
            },
          },
        },
        required: ['questions'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (toolName === 'approval_prompt') {
    return handleApprovalPrompt(request);
  } else if (toolName === 'ask_user_question') {
    return handleAskUserQuestion(request);
  } else {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }
});

// Handler for approval_prompt tool
async function handleApprovalPrompt(request: { params: { arguments?: Record<string, unknown> } }) {
  const { tool_name, input } = request.params.arguments as { tool_name: string; input: Record<string, unknown> };

  try {
    // Log the permission request
    logger.debug('MCP Permission request received', { tool_name, input, streamingId: CUI_STREAMING_ID });

    // Send the permission request to CUI server
    const response = await fetch(`${CUI_SERVER_URL}/api/permissions/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName: tool_name,
        toolInput: input,
        streamingId: CUI_STREAMING_ID || 'unknown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to notify CUI server', { status: response.status, error: errorText });
      throw new Error(`Failed to notify CUI server: ${errorText}`);
    }

    // Get the permission request ID from the notification response
    const notificationData = await response.json() as PermissionNotificationResponse;
    const permissionRequestId = notificationData.id;

    logger.debug('Permission request created', { permissionRequestId, streamingId: CUI_STREAMING_ID });

    // Poll for permission decision
    const POLL_INTERVAL = 1000; // 1 second
    const TIMEOUT = 60 * 60 * 1000; // 1 hour
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT) {
        logger.warn('Permission request timed out', { tool_name, permissionRequestId });
        const timeoutResponse = {
          behavior: 'deny',
          message: 'Permission request timed out after 10 minutes after user did not respond',
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(timeoutResponse),
          }],
        };
      }

      // Poll for permission status
      const pollResponse = await fetch(
        `${CUI_SERVER_URL}/api/permissions?streamingId=${CUI_STREAMING_ID}&status=pending`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!pollResponse.ok) {
        logger.error('Failed to poll permission status', { status: pollResponse.status });
        throw new Error(`Failed to poll permission status: ${pollResponse.status}`);
      }

      const { permissions } = await pollResponse.json() as PermissionsResponse;
      const permission = permissions.find((p) => p.id === permissionRequestId);

      if (!permission) {
        // Permission has been processed (no longer pending)
        // Fetch all permissions to find our specific one
        const allPermissionsResponse = await fetch(
          `${CUI_SERVER_URL}/api/permissions?streamingId=${CUI_STREAMING_ID}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!allPermissionsResponse.ok) {
          logger.error('Failed to fetch all permissions', { status: allPermissionsResponse.status });
          throw new Error(`Failed to fetch all permissions: ${allPermissionsResponse.status}`);
        }

        const { permissions: allPermissions } = await allPermissionsResponse.json() as PermissionsResponse;
        const processedPermission = allPermissions.find((p) => p.id === permissionRequestId);

        if (processedPermission) {
          if (processedPermission.status === 'approved') {
            logger.debug('Permission approved', { tool_name, permissionRequestId });
            const approvalResponse = {
              behavior: 'allow',
              updatedInput: processedPermission.modifiedInput || input,
            };
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(approvalResponse),
              }],
            };
          } else if (processedPermission.status === 'denied') {
            logger.debug('Permission denied', { tool_name, permissionRequestId });
            const denyResponse = {
              behavior: 'deny',
              message: processedPermission.denyReason || 'The user doesnt want to proceed with this tool use.The tool use was rejected(eg.if it was a file edit, the new_string was NOT written to the file).STOP what you are doing and wait for the user to tell you how to proceed.',
            };
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(denyResponse),
              }],
            };
          }
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  } catch (error) {
    logger.error('Error processing permission request', { error });

    // Return a deny response on error
    const denyResponse = {
      behavior: 'deny',
      message: `Permission denied due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(denyResponse),
      }],
    };
  }
}

// Handler for ask_user_question tool
async function handleAskUserQuestion(request: { params: { arguments?: Record<string, unknown> } }) {
  const { questions } = request.params.arguments as {
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect: boolean;
    }>;
  };

  try {
    logger.debug('MCP Question request received', { questionCount: questions.length, streamingId: CUI_STREAMING_ID });

    // Send the question request to CUI server
    const response = await fetch(`${CUI_SERVER_URL}/api/questions/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questions,
        streamingId: CUI_STREAMING_ID || 'unknown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to notify CUI server for question', { status: response.status, error: errorText });
      throw new Error(`Failed to notify CUI server: ${errorText}`);
    }

    // Get the question request ID from the notification response
    const notificationData = await response.json() as QuestionNotificationResponse;
    const questionRequestId = notificationData.id;

    logger.debug('Question request created', { questionRequestId, streamingId: CUI_STREAMING_ID });

    // Poll for answer
    const POLL_INTERVAL = 1000; // 1 second
    const TIMEOUT = 60 * 60 * 1000; // 1 hour
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT) {
        logger.warn('Question request timed out', { questionRequestId });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Question timed out - user did not respond' }),
          }],
        };
      }

      // Poll for question status
      const pollResponse = await fetch(
        `${CUI_SERVER_URL}/api/questions?streamingId=${CUI_STREAMING_ID}&status=pending`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!pollResponse.ok) {
        logger.error('Failed to poll question status', { status: pollResponse.status });
        throw new Error(`Failed to poll question status: ${pollResponse.status}`);
      }

      const { questions: pendingQuestions } = await pollResponse.json() as QuestionsResponse;
      const pendingQuestion = pendingQuestions.find((q) => q.id === questionRequestId);

      if (!pendingQuestion) {
        // Question has been answered (no longer pending)
        // Fetch all questions to find our specific one
        const allQuestionsResponse = await fetch(
          `${CUI_SERVER_URL}/api/questions?streamingId=${CUI_STREAMING_ID}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!allQuestionsResponse.ok) {
          logger.error('Failed to fetch all questions', { status: allQuestionsResponse.status });
          throw new Error(`Failed to fetch all questions: ${allQuestionsResponse.status}`);
        }

        const { questions: allQuestions } = await allQuestionsResponse.json() as QuestionsResponse;
        const answeredQuestion = allQuestions.find((q) => q.id === questionRequestId);

        if (answeredQuestion && answeredQuestion.status === 'answered') {
          logger.debug('Question answered', { questionRequestId, answers: answeredQuestion.answers });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ answers: answeredQuestion.answers }),
            }],
          };
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  } catch (error) {
    logger.error('Error processing question request', { error });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `Question failed: ${error instanceof Error ? error.message : 'Unknown error'}` }),
      }],
    };
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Permission server started', { cuiServerUrl: CUI_SERVER_URL });
}

main().catch((error) => {
  logger.error('MCP server error', { error });
  process.exit(1);
});