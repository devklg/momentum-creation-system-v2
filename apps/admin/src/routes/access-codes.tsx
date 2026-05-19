/**
 * /access-codes — mint and list TM-XXXX access codes.
 *
 * Format locked Chat #94: TM-XXXX, 4 chars, 31-character alphabet excluding
 * 0/O, 1/I, L. One code per BA, owned for life, never reassigned. Codes are
 * reused by the same BA for every new BA they sponsor.
 *
 * Server contract:
 *  - GET  /api/admin/access-codes → { ok, count, codes: AccessCodeListItem[] }
 *  - POST /api/admin/access-codes { sponsorBaId, sponsorThreeBaId,
 *      sponsorFirstName, sponsorLastName, note?, explicit? } → { ok, code }
 *
 * Server enforces alphabet, length, uniqueness, one-per-BA invariant, and
 * the access-code attribution to its owning BA.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AccessCode {
  code: string;
  sponsorBaId: string;
  sponsorThreeBaId: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  active: boolean;
  createdAt: string;
  note?: string | null;
}

interface ListResponse {
  ok: boolean;
  count?: number;
  codes?: AccessCode[];
  error?: string;
}

interface MintResponse {
  ok: boolean;
  code?: AccessCode;
  error?: string;
  details?: unknown;
}

export function AccessCodesPage() {
  const [codes, setCodes] = useState<AccessCode[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [sponsorBaId, setSponsorBaId] = useState('');
  const [sponsorThreeBaId, setSponsorThreeBaId] = useState('');
  const [sponsorFirstName, setSponsorFirstName] = useState('');
  const [sponsorLastName, setSponsorLastName] = useState('');
  const [note, setNote] = useState('');
  const [minting, setMinting] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [justMinted, setJustMinted] = useState<AccessCode | null>(null);

  const loadCodes = async () => {
    setLoadErr(null);
    try {
      const res = await fetch('/api/admin/access-codes', { credentials: 'include' });
      const data = (await res.json()) as ListResponse;
      if (!data.ok) {
        setLoadErr(data.error ?? 'Could not load codes.');
        return;
      }
      setCodes(data.codes ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setLoadErr(`Network error: ${msg}`);
    }
  };

  useEffect(() => {
    void loadCodes();
  }, []);

  const canMint =
    !minting &&
    sponsorBaId.trim().length > 0 &&
    sponsorThreeBaId.trim().length > 0 &&
    sponsorFirstName.trim().length > 0 &&
    sponsorLastName.trim().length > 0;

  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    setMinting(true);
    setMintErr(null);
    setJustMinted(null);
    try {
      const res = await fetch('/api/admin/access-codes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorBaId: sponsorBaId.trim(),
          sponsorThreeBaId: sponsorThreeBaId.trim(),
          sponsorFirstName: sponsorFirstName.trim(),
          sponsorLastName: sponsorLastName.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = (await res.json()) as MintResponse;
      if (!data.ok || !data.code) {
        setMintErr(data.error ?? 'Could not mint code.');
        return;
      }
      setJustMinted(data.code);
      setSponsorBaId('');
      setSponsorThreeBaId('');
      setSponsorFirstName('');
      setSponsorLastName('');
      setNote('');
      await loadCodes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setMintErr(`Network error: ${msg}`);
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section B
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Access Codes</h1>
      <p className="text-cream-mute text-sm mb-10 max-w-2xl">
        Mint a TM-XXXX code for a Brand Ambassador. The BA reuses this same code for every new
        BA they sponsor. Format: 4 characters from a 31-character alphabet (no 0/O, no 1/I, no L).
        One code per BA — if the BA already owns one, the mint returns the existing code.
      </p>

      <section className="border border-line rounded-md p-6 mb-10">
        <h2 className="font-display text-[20px] text-cream mb-5">Mint a new code</h2>
        <form onSubmit={handleMint} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div>
            <Label htmlFor="sponsorBaId">Sponsor BA ID (Team Magnificent)</Label>
            <Input
              id="sponsorBaId"
              value={sponsorBaId}
              onChange={(e) => setSponsorBaId(e.target.value)}
              placeholder="TMBA-XXXX..."
              required
              disabled={minting}
            />
          </div>
          <div>
            <Label htmlFor="sponsorThreeBaId">Sponsor THREE BA ID</Label>
            <Input
              id="sponsorThreeBaId"
              value={sponsorThreeBaId}
              onChange={(e) => setSponsorThreeBaId(e.target.value)}
              placeholder="1845964"
              required
              disabled={minting}
            />
          </div>
          <div>
            <Label htmlFor="sponsorFirstName">First Name</Label>
            <Input
              id="sponsorFirstName"
              value={sponsorFirstName}
              onChange={(e) => setSponsorFirstName(e.target.value)}
              required
              disabled={minting}
            />
          </div>
          <div>
            <Label htmlFor="sponsorLastName">Last Name</Label>
            <Input
              id="sponsorLastName"
              value={sponsorLastName}
              onChange={(e) => setSponsorLastName(e.target.value)}
              required
              disabled={minting}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for this code…"
              disabled={minting}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-4 mt-2">
            <Button type="submit" disabled={!canMint}>
              {minting ? 'Minting\u2026' : 'Mint Code'}
            </Button>
            {justMinted && (
              <div className="text-sm">
                <span className="text-cream-mute">Minted: </span>
                <span className="font-mono text-gold tracking-wide">{justMinted.code}</span>
                <span className="text-cream-mute">
                  {' '}for {justMinted.sponsorFirstName} {justMinted.sponsorLastName}
                </span>
              </div>
            )}
          </div>
          {mintErr && (
            <p className="md:col-span-2 text-[13px] font-mono tracking-[0.04em] text-red-400">
              {mintErr}
            </p>
          )}
        </form>
      </section>

      <section>
        <h2 className="font-display text-[20px] text-cream mb-5">Existing codes</h2>
        {loadErr && (
          <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{loadErr}</p>
        )}
        {codes === null ? (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            Loading…
          </p>
        ) : codes.length === 0 ? (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            No codes minted yet.
          </p>
        ) : (
          <div className="border border-line rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/[0.025]">
                <tr className="text-left">
                  <Th>Code</Th>
                  <Th>Owner</Th>
                  <Th>BA ID</Th>
                  <Th>THREE ID</Th>
                  <Th>Created</Th>
                  <Th>Active</Th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code} className="border-t border-line">
                    <Td>
                      <span className="font-mono text-gold">{c.code}</span>
                    </Td>
                    <Td>
                      {c.sponsorFirstName} {c.sponsorLastName}
                    </Td>
                    <Td>
                      <span className="font-mono text-cream-mute">{c.sponsorBaId}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-cream-mute">{c.sponsorThreeBaId}</span>
                    </Td>
                    <Td className="text-cream-mute">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      {c.active ? (
                        <span className="text-teal text-[11px] font-mono uppercase tracking-label">
                          active
                        </span>
                      ) : (
                        <span className="text-cream-faint text-[11px] font-mono uppercase tracking-label">
                          inactive
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={['px-4 py-2.5', className ?? ''].join(' ')}>{children}</td>;
}
