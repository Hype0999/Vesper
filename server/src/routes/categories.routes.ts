import type { FastifyPluginAsync } from 'fastify';
import { authenticateUser } from '../middleware/auth.js';
import { getCategoriesService } from '../services/categories.service.js';

export const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticateUser);
  const categoriesService = getCategoriesService();

  // 1. List categories
  fastify.get('/', async (request, reply) => {
    const categories = categoriesService.getCategories(request.user!.id);
    return reply.send({
      success: true,
      data: { categories },
    });
  });

  // 2. Create category
  fastify.post<{ Body: { name: string; color?: string } }>('/', async (request, reply) => {
    const { name, color } = request.body || {};
    if (!name || !name.trim()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category name is required' },
      });
    }

    try {
      const category = categoriesService.createCategory(request.user!.id, name, color);
      return reply.status(201).send({
        success: true,
        data: { category },
      });
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'CATEGORY_EXISTS', message: 'A category with this name already exists' },
      });
    }
  });

  // 3. Delete category
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    categoriesService.deleteCategory(request.user!.id, request.params.id);
    return reply.send({ success: true });
  });
};
