import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { FileText, X, Lock, CheckCircle2, AlertCircle, Eye, Edit3 } from 'lucide-react';
import type { Category, ApiResponse, NoteItem } from '@media-hub/shared';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (note: NoteItem) => void;
  categories: Category[];
  editingNote?: NoteItem | null;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
  categories,
  editingNote,
}) => {
  const { isUnlocked, openUnlockModal } = useVault();
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [tags, setTags] = useState<string>('');
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title);
      setContent(editingNote.content);
      setCategoryId(editingNote.categoryId || '');
      setIsPrivate(editingNote.isPrivate);
      setTags(editingNote.tags?.join(', ') || '');
    } else {
      setTitle('');
      setContent('');
      setCategoryId('');
      setIsPrivate(false);
      setTags('');
    }
    setIsPreview(false);
    setError(null);
  }, [editingNote, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a note title.');
      return;
    }

    if (isPrivate && !isUnlocked) {
      setError('You must unlock the Private Vault first to manage private notes.');
      openUnlockModal();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingNote ? `/api/notes/${editingNote.id}` : '/api/notes';
      const method = editingNote ? 'PUT' : 'POST';

      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          title: title.trim(),
          content,
          categoryId: categoryId || null,
          isPrivate,
          tags: tagArray,
        }),
      });

      const json: ApiResponse<{ note: NoteItem }> = await res.json();

      if (res.ok && json.success) {
        onSaveSuccess(json.data.note);
        onClose();
      } else if (!json.success) {
        setError(json.error.message);
      } else {
        setError('Failed to save note.');
      }
    } catch {
      setError('Network error saving note.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 5, 7, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: 'var(--space-6)',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-elevated)',
          position: 'relative',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSaving}
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-xs)',
          }}
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {editingNote ? 'Edit Note' : 'New Note'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Markdown supported • Autosaves to SQLite
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-danger)',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {/* Title */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="label" htmlFor="note-title">Title</label>
            <input
              id="note-title"
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              disabled={isSaving}
              required
            />
          </div>

          {/* Editor / Preview Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="label" style={{ margin: 0 }}>Content (Markdown)</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`btn btn-ghost ${!isPreview ? 'btn-secondary' : ''}`}
                onClick={() => setIsPreview(false)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                <Edit3 size={12} /> Edit
              </button>
              <button
                type="button"
                className={`btn btn-ghost ${isPreview ? 'btn-secondary' : ''}`}
                onClick={() => setIsPreview(true)}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          </div>

          {/* Textarea or Preview */}
          {!isPreview ? (
            <textarea
              className="input"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write markdown here... Supports # headers, - lists, `code`, **bold**, etc."
              disabled={isSaving}
              style={{
                fontFamily: 'inherit',
                lineHeight: '1.6',
                resize: 'vertical',
                minHeight: '160px',
                marginBottom: 'var(--space-3)',
              }}
            />
          ) : (
            <div
              style={{
                minHeight: '160px',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: 'var(--space-3)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-3)',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {content || <span style={{ color: 'var(--text-muted)' }}>Nothing to preview</span>}
            </div>
          )}

          {/* Category and Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div>
              <label className="label" htmlFor="note-category">Category</label>
              <select
                id="note-category"
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isSaving}
                style={{ background: 'var(--bg-surface-elevated)' }}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="note-tags">Tags (Comma-separated)</label>
              <input
                id="note-tags"
                type="text"
                className="input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. ideas, work"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Private Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3)',
              background: isPrivate ? 'var(--vault-subtle)' : 'var(--bg-surface)',
              border: isPrivate ? '1px solid var(--vault-border)' : '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              marginBottom: 'var(--space-4)',
            }}
            onClick={() => {
              if (!isPrivate && !isUnlocked) {
                openUnlockModal();
              } else {
                setIsPrivate(!isPrivate);
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Lock size={16} style={{ color: isPrivate ? 'var(--vault-primary)' : 'var(--text-muted)' }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: isPrivate ? 'var(--vault-primary)' : 'var(--text-primary)', margin: 0 }}>
                  Mark as Private Note
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                  Stored in private vault partition. Requires step-up authorization.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={() => {}}
              style={{ accentColor: 'var(--vault-primary)', cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !title.trim()}
            >
              <CheckCircle2 size={16} />
              <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
