import crypto from 'node:crypto';
import { getDatabaseService } from '../db/index.js';
import type { NoteItem } from '@media-hub/shared';

export class NotesService {
  async getNotesList(options: {
    userId: string;
    categoryId?: string;
    isVaultUnlocked: boolean;
    vaultOnly?: boolean;
    search?: string;
  }): Promise<NoteItem[]> {
    const db = getDatabaseService().getDb();

    let query = `
      SELECT n.*, c.name as category_name, c.color as category_color
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      WHERE n.user_id = ?
    `;
    const params: (string | number)[] = [options.userId];

    if (options.categoryId) {
      query += ` AND n.category_id = ?`;
      params.push(options.categoryId);
    }

    if (options.vaultOnly) {
      if (!options.isVaultUnlocked) return [];
      query += ` AND n.is_private = 1`;
    } else if (!options.isVaultUnlocked) {
      query += ` AND n.is_private = 0`;
    }

    if (options.search && options.search.trim()) {
      query += ` AND (n.title LIKE ? OR n.content LIKE ?)`;
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY n.is_pinned DESC, n.updated_at DESC`;

    interface NoteRow {
      id: string;
      user_id: string;
      title: string;
      content: string;
      is_encrypted: number;
      category_id: string | null;
      category_name: string | null;
      category_color: string | null;
      is_private: number;
      is_favorite: number;
      is_pinned: number;
      created_at: string;
      updated_at: string;
    }

    const rows = db.prepare(query).all(...params) as NoteRow[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      content: r.content,
      isEncrypted: r.is_encrypted === 1,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      isPrivate: r.is_private === 1,
      isFavorite: r.is_favorite === 1,
      isPinned: r.is_pinned === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getNoteById(id: string, userId: string, isVaultUnlocked: boolean): Promise<NoteItem | null> {
    const db = getDatabaseService().getDb();
    const row = db.prepare(`
      SELECT n.*, c.name as category_name, c.color as category_color
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      WHERE n.id = ? AND n.user_id = ?
    `).get(id, userId) as Record<string, unknown> | undefined;

    if (!row) return null;
    if (row.is_private === 1 && !isVaultUnlocked) {
      return null;
    }

    return {
      id: row.id as string,
      userId: row.user_id as string,
      title: row.title as string,
      content: row.content as string,
      isEncrypted: (row.is_encrypted as number) === 1,
      categoryId: row.category_id as string | null,
      categoryName: row.category_name as string | null,
      categoryColor: row.category_color as string | null,
      isPrivate: (row.is_private as number) === 1,
      isFavorite: (row.is_favorite as number) === 1,
      isPinned: (row.is_pinned as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async createNote(options: {
    userId: string;
    title: string;
    content: string;
    categoryId?: string;
    isPrivate: boolean;
    tags?: string[];
  }): Promise<NoteItem> {
    const db = getDatabaseService().getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (
        id, user_id, title, content, is_encrypted, category_id,
        is_private, is_favorite, is_pinned, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, 0, 0, ?, ?
      )
    `).run(
      id,
      options.userId,
      options.title,
      options.content,
      options.isPrivate ? 1 : 0,
      options.categoryId ?? null,
      options.isPrivate ? 1 : 0,
      now,
      now
    );

    if (options.tags && options.tags.length > 0) {
      for (const tagName of options.tags) {
        const trimmed = tagName.trim();
        if (!trimmed) continue;
        let tag = db.prepare(`SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE`).get(options.userId, trimmed) as { id: string } | undefined;
        let tagId: string;
        if (!tag) {
          tagId = crypto.randomUUID();
          db.prepare(`INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`).run(tagId, options.userId, trimmed, now);
        } else {
          tagId = tag.id;
        }
        db.prepare(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`).run(id, tagId);
      }
    }

    if (!options.isPrivate) {
      try {
        db.prepare(`
          INSERT INTO normal_search_index (entity_id, entity_type, user_id, title, content_or_desc, tag_names)
          VALUES (?, 'note', ?, ?, ?, ?)
        `).run(
          id,
          options.userId,
          options.title,
          options.content.slice(0, 500),
          options.tags?.join(' ') ?? ''
        );
      } catch { /* ignore */ }
    }

    return this.getNoteById(id, options.userId, true) as Promise<NoteItem>;
  }

  async updateNote(
    id: string,
    userId: string,
    updates: {
      title?: string;
      content?: string;
      categoryId?: string | null;
      isFavorite?: boolean;
      isPinned?: boolean;
    },
    isVaultUnlocked: boolean
  ): Promise<NoteItem | null> {
    const existing = await this.getNoteById(id, userId, isVaultUnlocked);
    if (!existing) return null;

    const db = getDatabaseService().getDb();
    const now = new Date().toISOString();

    const title = updates.title ?? existing.title;
    const content = updates.content ?? existing.content;
    const categoryId = updates.categoryId !== undefined ? updates.categoryId : existing.categoryId;
    const isFavorite = updates.isFavorite !== undefined ? (updates.isFavorite ? 1 : 0) : (existing.isFavorite ? 1 : 0);
    const isPinned = updates.isPinned !== undefined ? (updates.isPinned ? 1 : 0) : (existing.isPinned ? 1 : 0);

    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, category_id = ?, is_favorite = ?, is_pinned = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(title, content, categoryId, isFavorite, isPinned, now, id, userId);

    return this.getNoteById(id, userId, isVaultUnlocked);
  }

  async deleteNote(id: string, userId: string, isVaultUnlocked: boolean): Promise<boolean> {
    const existing = await this.getNoteById(id, userId, isVaultUnlocked);
    if (!existing) return false;

    const db = getDatabaseService().getDb();
    db.prepare(`DELETE FROM notes WHERE id = ? AND user_id = ?`).run(id, userId);
    try {
      db.prepare(`DELETE FROM normal_search_index WHERE entity_id = ?`).run(id);
    } catch { /* ignore */ }
    return true;
  }
}

let notesServiceInstance: NotesService | null = null;
export function getNotesService(): NotesService {
  if (!notesServiceInstance) {
    notesServiceInstance = new NotesService();
  }
  return notesServiceInstance;
}
