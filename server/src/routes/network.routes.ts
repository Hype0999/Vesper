import type { FastifyPluginAsync } from 'fastify';
import { authenticateUser, requireAdmin } from '../middleware/auth.js';
import { getNetworkService } from '../services/network.service.js';
import type { ApiResponse, NetworkStatus, WifiNetwork } from '@media-hub/shared';

export const networkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateUser);

  const networkService = getNetworkService();

  // 1. Get current network status and IP address
  fastify.get('/status', async (_request, reply) => {
    const status = await networkService.getNetworkStatus();
    return reply.send({
      success: true,
      data: { status },
    } satisfies ApiResponse<{ status: NetworkStatus }>);
  });

  // 2. Scan available Wi-Fi networks
  fastify.get('/scan', async (_request, reply) => {
    const networks = await networkService.scanWifi();
    return reply.send({
      success: true,
      data: { networks },
    } satisfies ApiResponse<{ networks: WifiNetwork[] }>);
  });

  // 3. Connect to a Wi-Fi network (phone hotspot or train Wi-Fi - Admin only)
  fastify.post<{
    Body: { ssid: string; password?: string };
  }>('/connect', { preHandler: requireAdmin }, async (request, reply) => {
    const { ssid, password } = request.body || {};
    if (!ssid || !ssid.trim()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Wi-Fi SSID is required' },
      });
    }

    const result = await networkService.connectWifi(ssid.trim(), password);
    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: { code: 'WIFI_CONNECT_FAILED', message: result.message },
      });
    }

    return reply.send({
      success: true,
      data: { message: result.message },
    });
  });

  // 4. Toggle Raspberry Pi Wi-Fi Hotspot Mode
  fastify.post<{
    Body: { enable: boolean; ssid?: string; password?: string };
  }>('/hotspot', async (request, reply) => {
    const { enable, ssid, password } = request.body || {};
    const result = await networkService.toggleHotspot(!!enable, ssid, password);

    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: { code: 'HOTSPOT_TOGGLE_FAILED', message: result.message },
      });
    }

    return reply.send({
      success: true,
      data: { message: result.message },
    });
  });
};
