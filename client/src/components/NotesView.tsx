import React from 'react';
import { FileText, Lock, Pin, Plus, Calendar } from 'lucide-react';
import type { NoteItem } from '@media-hub/shared';

interface NotesViewProps {
  notes: NoteItem[];
  onSelectNote: (note: NoteItem) => void;
  onOpenNewNote: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({ notes, onSelectNote, onOpenNewNote }) => {
  if (notes.length === 0) {
    return (
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12) var(--space-4)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <FileText size={26} strokeWidth={1.5} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
          No notes yet
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px', marginBottom: 'var(--space-5)' }}>
          Write down thoughts, checklists, or private encrypted notes with Markdown support.
        </p>
        <button className="btn btn-primary" onClick={onOpenNewNote}>
          <Plus size={16} />
          <span>New Note</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {notes.map((note) => (
        <div
          key={note.id}
          className="card"
          style={{
            padding: 'var(--space-5)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: note.isPrivate ? '3px solid var(--vault-primary)' : '1px solid var(--border-subtle)',
            transition: 'transform var(--duration-fast) var(--ease-spring), border-color var(--duration-fast)',
          }}
          onClick={() => onSelectNote(note)}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {note.title}
            </h4>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'var(--space-2)' }}>
              {note.isPinned && <Pin size={13} style={{ color: 'var(--text-secondary)' }} />}
              {note.isPrivate && (
                <span className="badge badge-warning" style={{ background: 'var(--vault-subtle)', color: 'var(--vault-primary)', padding: '1px 5px', fontSize: '0.65rem' }}>
                  <Lock size={10} /> Vault
                </span>
              )}
            </div>
          </div>

          {/* Snippet preview */}
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              margin: '0 0 var(--space-4) 0',
              flex: 1,
            }}
          >
            {note.content || <span style={{ color: 'var(--text-muted)' }}>Empty note</span>}
          </p>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: 'auto',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-2)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={11} />
              {new Date(note.updatedAt).toLocaleDateString()}
            </span>

            {note.categoryName && (
              <span className="badge badge-subtle" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                {note.categoryName}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
