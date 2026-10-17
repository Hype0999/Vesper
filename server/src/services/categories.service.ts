import crypto from 'node:crypto';
import { getDatabaseService } from '../db/index.js';
import type { Category } from '@media-hub/shared';

export class CategoriesService {
  getCategories(userId: string): Category[] {
    const db = getDatabaseService().getDb();
    const rows = db.prepare(`SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC`).all(userId) as Array<{
      id: string;
      user_id: string;
      name: string;
      color: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at,
    }));
  }

  createCategory(userId: string, name: string, color: string = '#3b82f6'): Category {
    const db = getDatabaseService().getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, name.trim(), color, now);

    return {
      id,
      userId,
      name: name.trim(),
      color,
      createdAt: now,
    };
  }

  deleteCategory(userId: string, id: string): boolean {
    const db = getDatabaseService().getDb();
    db.prepare(`DELETE FROM categories WHERE id = ? AND user_id = ?`).run(id, userId);
    return true;
  }
}

let categoriesServiceInstance: CategoriesService | null = null;
export function getCategoriesService(): CategoriesService {
  if (!categoriesServiceInstance) {
    categoriesServiceInstance = new CategoriesService();
  }
  return categoriesServiceInstance;
}
