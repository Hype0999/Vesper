import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HdmiTvService } from '../services/hdmi-tv.service.js';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';
import type { ApiResponse, TvSessionStatus, TvRemoteCommand, TvPlaybackState } from '@media-hub/shared';

const RemoteCommandSchema = z.object({
  action: z.enum([
    'up',
    'down',
    'left',
    'right',
    'select',
    'back',
    'play_pause',
    'play',
    'pause',
    'stop',
    'volume_up',
    'volume_down',
    'mute',
    'seek_forward',
    'seek_backward',
    'cast',
    'home',
    'fullscreen',
  ]),
  payload: z.any().optional(),
});

const CastMediaSchema = z.object({
  mediaId: z.string().min(1, 'Media ID is required to cast to TV'),
  startTime: z.number().min(0).optional(),
});

const PlaybackStateSchema = z.object({
  playbackState: z.enum(['playing', 'paused', 'stopped', 'idle']).optional(),
  currentTime: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  volume: z.number().min(0).max(100).optional(),
  isMuted: z.boolean().optional(),
});

export const tvRoutes: FastifyPluginAsync = async (fastify) => {
  const tvService = HdmiTvService.getInstance();

  // 1. Get current HDMI & TV playback status
  fastify.get('/status', { preHandler: authenticateUser }, async (_request, reply) => {
    const status = tvService.getStatus();
    return reply.send({
      success: true,
      data: status,
    } satisfies ApiResponse<TvSessionStatus>);
  });

  // 2. Real-Time Server-Sent Events (SSE) Stream for TV Display & Mobile Remotes
  fastify.get('/events', async (_request, reply) => {
    tvService.addSseClient(reply);
  });

  // 3. Dispatch Remote Control Command (from Phone Virtual Remote or Web)
  fastify.post('/remote', { preHandler: authenticateUser }, async (request, reply) => {
    const parsed = RemoteCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid remote command parameters',
        },
      } satisfies ApiResponse<never>);
    }

    const command = tvService.dispatchRemoteCommand(
      parsed.data.action,
      parsed.data.payload,
      'phone_remote'
    );

    return reply.send({
      success: true,
      data: { command },
    } satisfies ApiResponse<{ command: TvRemoteCommand }>);
  });

  // 4. Cast Media Item to the TV Screen
  fastify.post('/cast', { preHandler: authenticateUser }, async (request, reply) => {
    const parsed = CastMediaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid cast parameters',
        },
      } satisfies ApiResponse<never>);
    }

    try {
      await tvService.castMediaToTv(parsed.data.mediaId, parsed.data.startTime || 0);
      return reply.send({
        success: true,
        data: {
          casted: true,
          status: tvService.getStatus(),
        },
      } satisfies ApiResponse<{ casted: boolean; status: TvSessionStatus }>);
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'CAST_ERROR',
          message: err?.message || 'Failed to cast media to TV',
        },
      } satisfies ApiResponse<never>);
    }
  });

  // 5. Update Playback State from the active TV screen
  fastify.post('/playback-state', async (request, reply) => {
    const parsed = PlaybackStateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid playback state parameters',
        },
      } satisfies ApiResponse<never>);
    }

    const updated = tvService.updatePlaybackState(parsed.data);
    return reply.send({
      success: true,
      data: { playback: updated },
    } satisfies ApiResponse<{ playback: TvPlaybackState }>);
  });

  // 6. Test & Diagnostic: Simulate HDMI Display Toggle (Admin only)
  fastify.post('/simulate', { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({ connected: z.boolean() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Parameter "connected" (boolean) required' },
      } satisfies ApiResponse<never>);
    }

    const status = tvService.simulateConnectionToggle(parsed.data.connected);
    return reply.send({
      success: true,
      data: status,
    } satisfies ApiResponse<TvSessionStatus>);
  });
};

