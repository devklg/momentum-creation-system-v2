/**
 * C.4 — Kevin's private notes about a BA. Append-only.
 *
 * Free-text textarea + Append button. Posts to
 * POST /api/admin/bas/:baId/notes. The server stamps the note id, the
 * authoring admin BA, and the createdAt. Audit-logged as info severity.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type {
  AdminBaNoteEntry,
  AdminBaNoteResponse,
} from '@momentum/shared';

interface Props {
  baId: string;
  notes: AdminBaNoteEntry[];
  onAppended: (note: AdminBaNoteEntry) => void;
}

export function NotesPanel({ baId, notes, onAppended }: Props) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (text.trim().length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/bas/${encodeURIComponent(baId)}/notes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim() }),
        },
      );
      const data = (await res.json()) as
        | AdminBaNoteResponse
        | { ok: false; error: string };
      if (!data.ok) {
        setErr(data.error || 'Could not append note.');
        return;
      }
      onAppended(data.note);
      setText('');
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Append a note (Kevin-only, append-only)…"
          className="w-full bg-transparent border border-line rounded-md px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none font-body"
          disabled={submitting}
        />
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={submitting || text.trim().length === 0}
          >
            {submitting ? 'Appending…' : 'Append note'}
          </Button>
          {err && (
            <p className="text-[12px] font-mono tracking-[0.04em] text-red-400">{err}</p>
          )}
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.noteId}
              className="border border-line rounded-md p-3 text-[13px] bg-cream/[0.015]"
            >
              <p className="text-cream whitespace-pre-wrap">{n.text}</p>
              <p className="text-[10px] font-mono tracking-label uppercase text-cream-faint mt-2">
                {new Date(n.createdAt).toLocaleString()} · {n.authorBaId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
