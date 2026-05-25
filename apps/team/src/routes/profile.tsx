/**
 * /profile — BA profile / settings (wireframe 3.8, Chat #134).
 *
 * Reads + writes the AUTHED session BA only (locked-spec 3.5). The page
 * fetches GET /api/profile once on mount and refetches after every
 * mutation so the read-only card and pending-verify badges stay aligned
 * with the latest server state.
 *
 * Hard locks honored:
 *   - Sponsor, threeBaId, tmBaId, accessCodeHeld render as read-only
 *     fields with no edit affordance. The server PATCH schema rejects
 *     these fields if they ever appear in a body.
 *   - First/last name edits warn the BA that the change is audited.
 *   - Email + phone changes use a two-step verify (J.8 default; flagged
 *     for Kevin in the heartbeat).
 *
 * Wire types are local (the `.team` TS6059 convention from Chat #120).
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ProfileSection } from '@/components/profile/ProfileSection';

interface ChannelMix {
  sms: boolean;
  email: boolean;
  inApp: boolean;
}

interface NotifPrefs {
  callbackRequested: ChannelMix;
  webinarReserved: ChannelMix;
  newSponsoredBA: ChannelMix;
  michaelComplete: ChannelMix;
  poolMovement: ChannelMix;
}

type NotifTopic = keyof NotifPrefs;
type NotifChannel = keyof ChannelMix;

interface BAProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  photoUrl: string | null;
  notifPrefs: NotifPrefs;
  tmBaId: string;
  threeBaId: string;
  accessCodeHeld: string | null;
  sponsor: { baId: string; threeBaId: string; fullName: string };
  pendingEmail: string | null;
  pendingPhone: string | null;
}

interface ProfileGetResponse {
  ok: true;
  profile: BAProfile;
}

const TOPIC_LABELS: Record<NotifTopic, string> = {
  callbackRequested: 'Prospect requested a callback',
  webinarReserved: 'Prospect reserved a webinar seat',
  newSponsoredBA: 'A new BA registered with your code',
  michaelComplete: 'Michael interview completed (downline)',
  poolMovement: 'Daily pool movement digest',
};

const CHANNEL_LABELS: Record<NotifChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  inApp: 'In-app',
};

export function ProfilePage() {
  const [profile, setProfile] = useState<BAProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ProfileGetResponse;
      setProfile(body.profile);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cream-mute font-mono text-sm">
        loading profile…
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cream-mute font-mono text-sm">
        could not load profile: {loadError ?? 'unknown'}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:py-14">
      <div className="max-w-2xl mx-auto space-y-7">
        <header>
          <p className="font-display tracking-eyebrow text-[12px] text-gold mb-2">
            TEAM MAGNIFICENT · PROFILE
          </p>
          <h1 className="font-display text-[34px] leading-[1.05] text-cream">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-[13px] text-cream-mute mt-1.5 font-mono">
            {profile.tmBaId}
          </p>
        </header>

        <IdentityCard profile={profile} />
        <PhotoEditor profile={profile} onSaved={refetch} />
        <NameEditor profile={profile} onSaved={refetch} />
        <TimezoneEditor profile={profile} onSaved={refetch} />
        <EmailChanger profile={profile} onSaved={refetch} />
        <PhoneChanger profile={profile} onSaved={refetch} />
        <PasswordChanger />
        <NotifPrefsEditor profile={profile} onSaved={refetch} />
      </div>
    </div>
  );
}

export default ProfilePage;

/* ─── Identity (read-only) ─── */

function IdentityCard({ profile }: { profile: BAProfile }) {
  return (
    <ProfileSection
      eyebrow="IDENTITY"
      title="Read-only"
      description="Sponsor, THREE BA ID, your TM BA ID, and your access code are not editable here. Sponsor changes go through Kevin as an audited admin override."
    >
      <dl className="grid grid-cols-1 gap-y-3 text-[13px]">
        <ReadOnlyRow label="Sponsor" value={profile.sponsor.fullName || '—'} />
        <ReadOnlyRow label="Sponsor THREE BA ID" value={profile.sponsor.threeBaId || '—'} />
        <ReadOnlyRow label="Your THREE BA ID" value={profile.threeBaId || '—'} />
        <ReadOnlyRow label="Your TM BA ID" value={profile.tmBaId} />
        <ReadOnlyRow
          label="Your access code"
          value={profile.accessCodeHeld ?? 'Not yet issued by Kevin'}
        />
      </dl>
    </ProfileSection>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4 border-b border-line/50 pb-2 last:border-0">
      <dt className="text-cream-mute">{label}</dt>
      <dd className="text-cream font-mono text-right break-all">{value}</dd>
    </div>
  );
}

/* ─── Photo ─── */

function PhotoEditor({ profile, onSaved }: { profile: BAProfile; onSaved: () => Promise<void> }) {
  const [url, setUrl] = useState(profile.photoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload = { photoUrl: url.trim() === '' ? null : url.trim() };
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await onSaved();
      setMsg({ kind: 'ok', text: 'Photo updated.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection
      eyebrow="PHOTO"
      title="Profile photo"
      description="Paste a URL to your photo. Direct uploads aren't wired yet — host the image somewhere (THREE back office, your own site) and paste the link."
    >
      <form onSubmit={save} className="space-y-3">
        {url && (
          <img
            src={url}
            alt="Profile preview"
            className="h-20 w-20 rounded-full object-cover border border-line"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <Label htmlFor="photoUrl">Photo URL</Label>
        <Input
          id="photoUrl"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
        <SaveRow saving={saving} msg={msg} />
      </form>
    </ProfileSection>
  );
}

/* ─── Name ─── */

function NameEditor({ profile, onSaved }: { profile: BAProfile; onSaved: () => Promise<void> }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const dirty = firstName !== profile.firstName || lastName !== profile.lastName;
  const ready =
    dirty && firstName.trim() !== '' && lastName.trim() !== '' && !saving;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await onSaved();
      setMsg({ kind: 'ok', text: 'Name updated. The change is in your audit log.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection
      eyebrow="NAME"
      title="Display name"
      description="Edits to your first or last name are recorded in the audit log. Use your real legal name where possible — your THREE record drives compensation; your TM name drives what prospects see on their invite page."
    >
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <SaveRow saving={saving} msg={msg} disabled={!ready} />
      </form>
    </ProfileSection>
  );
}

/* ─── Timezone ─── */

function getBrowserTimezones(): string[] {
  // Intl.supportedValuesOf is ES2022; the team build targets it already
  // (other code uses Intl.DateTimeFormat freely). Fall back if absent.
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (input: string) => string[] }
    ).supportedValuesOf;
    if (typeof fn === 'function') return fn('timeZone');
  } catch {
    /* fall through */
  }
  return [];
}

function TimezoneEditor({
  profile,
  onSaved,
}: {
  profile: BAProfile;
  onSaved: () => Promise<void>;
}) {
  const all = useMemo(getBrowserTimezones, []);
  const [tz, setTz] = useState(profile.timezone);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const dirty = tz !== profile.timezone;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timezone: tz }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await onSaved();
      setMsg({ kind: 'ok', text: 'Timezone updated.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection
      eyebrow="TIMEZONE"
      title="Local time"
      description="Drives Michael's slot windows and your daily digest delivery time."
    >
      <form onSubmit={save} className="space-y-3">
        <Label htmlFor="tz">IANA timezone</Label>
        {all.length > 0 ? (
          <select
            id="tz"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="h-12 w-full rounded-md border border-line bg-ink-2 px-3 text-cream"
          >
            {all.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        ) : (
          <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} />
        )}
        <SaveRow saving={saving} msg={msg} disabled={!dirty} />
      </form>
    </ProfileSection>
  );
}

/* ─── Email re-verify (two-step) ─── */

function EmailChanger({
  profile,
  onSaved,
}: {
  profile: BAProfile;
  onSaved: () => Promise<void>;
}) {
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'sent'>(profile.pendingEmail ? 'sent' : 'idle');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    if (newEmail.trim() === '' || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; deliveryStatus: string }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || body.ok === false) {
        throw new Error((body && 'error' in body && body.error) || `HTTP ${res.status}`);
      }
      setDeliveryStatus(body.deliveryStatus);
      setStep('sent');
      await onSaved();
      setMsg({ kind: 'ok', text: 'Code sent to the new address. Check that inbox.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'send failed' });
    } finally {
      setSaving(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6 || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || body.ok === false) {
        throw new Error((body && 'error' in body && body.error) || `HTTP ${res.status}`);
      }
      await onSaved();
      setStep('idle');
      setNewEmail('');
      setCode('');
      setDeliveryStatus(null);
      setMsg({ kind: 'ok', text: 'Email updated.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'verify failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection
      eyebrow="EMAIL"
      title="Email address"
      description="Changing your email requires a 6-digit verification code sent to the NEW address."
    >
      <div className="space-y-3">
        <div className="text-[13px] text-cream-mute">
          Current:{' '}
          <span className="font-mono text-cream break-all">{profile.email}</span>
        </div>

        {profile.pendingEmail && step === 'sent' && (
          <div className="text-[12px] font-mono tracking-[0.04em] text-gold bg-gold/5 border border-gold/30 rounded-md p-2.5">
            Pending verify: {profile.pendingEmail}
          </div>
        )}

        {step === 'idle' && (
          <form onSubmit={start} className="space-y-3">
            <Label htmlFor="newEmail">New email</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
            />
            <SaveRow saving={saving} msg={msg} label="Send code" />
          </form>
        )}

        {step === 'sent' && (
          <form onSubmit={verify} className="space-y-3">
            <Label htmlFor="emailCode">6-digit code</Label>
            <Input
              id="emailCode"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {deliveryStatus && deliveryStatus !== 'sent' && (
              <p className="text-[12px] text-cream-faint">
                (Email delivery: {deliveryStatus} — provider may be dormant in dev.)
              </p>
            )}
            <div className="flex gap-2">
              <SaveRow saving={saving} msg={msg} label="Verify" />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('idle');
                  setCode('');
                  setMsg(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </ProfileSection>
  );
}

/* ─── Phone re-verify (two-step — J.8 default) ─── */

function PhoneChanger({
  profile,
  onSaved,
}: {
  profile: BAProfile;
  onSaved: () => Promise<void>;
}) {
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'sent'>(profile.pendingPhone ? 'sent' : 'idle');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);

  async function start(e: FormEvent) {
    e.preventDefault();
    if (newPhone.trim() === '' || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPhone: newPhone.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; deliveryStatus: string }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || body.ok === false) {
        throw new Error((body && 'error' in body && body.error) || `HTTP ${res.status}`);
      }
      setDeliveryStatus(body.deliveryStatus);
      setStep('sent');
      await onSaved();
      setMsg({ kind: 'ok', text: 'Code sent via SMS to the new number.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'send failed' });
    } finally {
      setSaving(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6 || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || body.ok === false) {
        throw new Error((body && 'error' in body && body.error) || `HTTP ${res.status}`);
      }
      await onSaved();
      setStep('idle');
      setNewPhone('');
      setCode('');
      setDeliveryStatus(null);
      setMsg({ kind: 'ok', text: 'Phone updated.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'verify failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection
      eyebrow="PHONE"
      title="Phone number"
      description="Changing your phone requires a 6-digit SMS code sent to the NEW number. (Open question J.8 — current default mirrors email re-verify; subject to change.)"
    >
      <div className="space-y-3">
        <div className="text-[13px] text-cream-mute">
          Current:{' '}
          <span className="font-mono text-cream">{profile.phone}</span>
        </div>

        {profile.pendingPhone && step === 'sent' && (
          <div className="text-[12px] font-mono tracking-[0.04em] text-gold bg-gold/5 border border-gold/30 rounded-md p-2.5">
            Pending verify: {profile.pendingPhone}
          </div>
        )}

        {step === 'idle' && (
          <form onSubmit={start} className="space-y-3">
            <Label htmlFor="newPhone">New phone (E.164, e.g. +13235551234)</Label>
            <Input
              id="newPhone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              autoComplete="tel"
            />
            <SaveRow saving={saving} msg={msg} label="Send code" />
          </form>
        )}

        {step === 'sent' && (
          <form onSubmit={verify} className="space-y-3">
            <Label htmlFor="phoneCode">6-digit code</Label>
            <Input
              id="phoneCode"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {deliveryStatus && deliveryStatus !== 'sent' && (
              <p className="text-[12px] text-cream-faint">
                (SMS delivery: {deliveryStatus} — provider may be dormant in dev.)
              </p>
            )}
            <div className="flex gap-2">
              <SaveRow saving={saving} msg={msg} label="Verify" />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('idle');
                  setCode('');
                  setMsg(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </ProfileSection>
  );
}

/* ─── Password ─── */

function PasswordChanger() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const mismatch = confirm !== '' && newPassword !== confirm;
  const ready =
    currentPassword !== '' &&
    newPassword.length >= 8 &&
    newPassword === confirm &&
    !saving;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || body.ok === false) {
        throw new Error((body && 'error' in body && body.error) || `HTTP ${res.status}`);
      }
      setCurrent('');
      setNewPassword('');
      setConfirm('');
      setMsg({ kind: 'ok', text: 'Password updated.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'save failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSection eyebrow="PASSWORD" title="Password">
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label htmlFor="cpw">Current password</Label>
          <Input
            id="cpw"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <Label htmlFor="npw">New password (8+ chars)</Label>
          <Input
            id="npw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="cpw2">Confirm new password</Label>
          <Input
            id="cpw2"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {mismatch && (
            <p className="text-[12px] text-red-400 mt-1">Passwords do not match.</p>
          )}
        </div>
        <SaveRow saving={saving} msg={msg} disabled={!ready} />
      </form>
    </ProfileSection>
  );
}

/* ─── Notification preferences (J.12 default) ─── */

function NotifPrefsEditor({
  profile,
  onSaved,
}: {
  profile: BAProfile;
  onSaved: () => Promise<void>;
}) {
  const [prefs, setPrefs] = useState<NotifPrefs>(profile.notifPrefs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(profile.notifPrefs);

  function toggle(topic: NotifTopic, channel: NotifChannel) {
    setPrefs((p) => ({ ...p, [topic]: { ...p[topic], [channel]: !p[topic][channel] } }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notifPrefs: prefs }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await onSaved();
      setMsg({ kind: 'ok', text: 'Preferences saved.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'save failed' });
    } finally {
      setSaving(false);
    }
  }

  const topics = Object.keys(TOPIC_LABELS) as NotifTopic[];
  const channels: NotifChannel[] = ['sms', 'email', 'inApp'];

  return (
    <ProfileSection
      eyebrow="NOTIFICATIONS"
      title="What pings you"
      description="Pick the channel for each kind of alert. (Open question J.12 — defaults shown below are conservative; email defaults off until the provider is live.)"
    >
      <form onSubmit={save} className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-cream-mute text-left">
                <th className="font-normal pb-2">Alert</th>
                {channels.map((c) => (
                  <th key={c} className="font-normal pb-2 text-center w-20">
                    {CHANNEL_LABELS[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t} className="border-t border-line/40">
                  <td className="py-2.5 pr-3 text-cream">{TOPIC_LABELS[t]}</td>
                  {channels.map((c) => (
                    <td key={c} className="py-2.5 text-center">
                      <Checkbox
                        checked={prefs[t][c]}
                        onCheckedChange={() => toggle(t, c)}
                        aria-label={`${TOPIC_LABELS[t]} via ${CHANNEL_LABELS[c]}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SaveRow saving={saving} msg={msg} disabled={!dirty} />
      </form>
    </ProfileSection>
  );
}

/* ─── Shared save/feedback row ─── */

function SaveRow({
  saving,
  msg,
  disabled,
  label = 'Save',
}: {
  saving: boolean;
  msg: { kind: 'ok' | 'err'; text: string } | null;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button type="submit" disabled={disabled || saving} size="sm">
        {saving ? 'Saving…' : label}
      </Button>
      {msg && (
        <span
          className={
            msg.kind === 'ok'
              ? 'text-[12px] font-mono text-emerald-400'
              : 'text-[12px] font-mono text-red-400'
          }
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
