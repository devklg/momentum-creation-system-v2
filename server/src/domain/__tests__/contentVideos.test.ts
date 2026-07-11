import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeKnowledge: mocks.writeKnowledge,
}));

type AnyRec = Record<string, unknown>;

beforeEach(() => {
  mocks.writeKnowledge.mockReset();
});

describe('contentVideos domain', () => {
  it('normalizes common YouTube URL shapes to an id', async () => {
    const { normalizeYoutubeId } = await import('../contentVideos.js');

    expect(normalizeYoutubeId('https://www.youtube.com/watch?v=1IZiV7RXdCY')).toBe('1IZiV7RXdCY');
    expect(normalizeYoutubeId('https://youtu.be/jGG1nSu9s94')).toBe('jGG1nSu9s94');
    expect(normalizeYoutubeId('https://www.youtube.com/embed/dEO_A-Q5pTE')).toBe('dEO_A-Q5pTE');
    expect(normalizeYoutubeId('not a video')).toBeNull();
  });

  it('requires section, title, description, audience, and a YouTube id or URL', async () => {
    const { validateContentVideoInput } = await import('../contentVideos.js');

    const result = validateContentVideoInput({
      section: 'Product Knowledge',
      title: '',
      youtubeId: null,
      url: null,
      description: 'Description',
      sortOrder: 10,
      audience: 'both',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_payload');
  });

  it('creates a content video through the knowledge-tier writer', async () => {
    const { createContentVideo } = await import('../contentVideos.js');

    const result = await createContentVideo({
      input: {
        section: 'Product Knowledge',
        title: 'GLP THREE Launch Webinar',
        youtubeId: '1IZiV7RXdCY',
        url: null,
        description: 'Foundation video.',
        sortOrder: 10,
        audience: 'both',
      },
      actor: { tmagId: 'TMAG-01' },
      now: '2026-07-04T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(mocks.writeKnowledge).toHaveBeenCalledTimes(1);
    const call = mocks.writeKnowledge.mock.calls[0]![0] as AnyRec;
    expect(call.mongoCollection).toBe('tmag_content_videos');
    expect((call.chroma as AnyRec).collection).toBe('mcs_content_videos');
    expect((call.mongoDoc as AnyRec).section).toBe('Product Knowledge');
    expect(String((call.neo4j as AnyRec).cypher)).toContain('TmagContentVideo');
  });
});
