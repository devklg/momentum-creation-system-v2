/**
 * /tenant - Admin Section F · Tenant Architecture.
 *
 * Master settings, template control, role/permission map, inheritance, and
 * save-time compliance validation.
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  McsSaveTenantTemplateResponse,
  McsTenantComplianceValidation,
  McsTenantOverview,
  McsTenantOverviewResponse,
  McsTenantSettings,
  McsTenantTemplateKey,
  McsTenantTemplateVersion,
  McsUpdateTenantSettingsResponse,
  McsValidateTenantTemplateResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function TenantPage() {
  const [overview, setOverview] = useState<McsTenantOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/tenant/overview', { credentials: 'include' });
      const data = (await res.json()) as McsTenantOverviewResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load tenant architecture.');
        return;
      }
      setOverview(data.overview);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="max-w-7xl space-y-6">
      <header>
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
          Admin · Section F · Tenant Architecture
        </p>
        <h1 className="font-display text-[36px] leading-none mb-2">
          Tenant Architecture
        </h1>
        <p className="text-cream-mute text-sm max-w-3xl">
          Master settings, template control, role permissions, inheritance, and
          fail-closed compliance for Team Magnificent.
        </p>
      </header>

      {err && <p className="font-mono text-[12px] text-red-400">{err}</p>}
      {loading && !overview && (
        <p className="font-mono text-[12px] text-cream-mute">Loading tenant map...</p>
      )}

      {overview && (
        <>
          <SettingsPanel
            settings={overview.settings}
            onSaved={(settings) =>
              setOverview((prev) => (prev ? { ...prev, settings } : prev))
            }
          />

          <TemplatePanel
            overview={overview}
            onSaved={(template) =>
              setOverview((prev) =>
                prev
                  ? {
                      ...prev,
                      templates: prev.templates.map((t) =>
                        t.templateKey === template.templateKey ? template : t,
                      ),
                    }
                  : prev,
              )
            }
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <RolesPanel overview={overview} />
            <InheritancePanel overview={overview} />
          </div>

          <CompliancePanel overview={overview} />
        </>
      )}
    </div>
  );
}

function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: McsTenantSettings;
  onSaved: (settings: McsTenantSettings) => void;
}) {
  const [tenantName, setTenantName] = useState(settings.tenantName);
  const [publicComDomain, setPublicComDomain] = useState(settings.publicComDomain);
  const [teamDomain, setTeamDomain] = useState(settings.teamDomain);
  const [adminDomain, setAdminDomain] = useState(settings.adminDomain);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<SaveState>('idle');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTenantName(settings.tenantName);
    setPublicComDomain(settings.publicComDomain);
    setTeamDomain(settings.teamDomain);
    setAdminDomain(settings.adminDomain);
  }, [settings]);

  const canSave = reason.trim().length > 0 && state !== 'saving';

  const save = async () => {
    setState('saving');
    setErr(null);
    try {
      const res = await fetch('/api/admin/tenant/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { tenantName, publicComDomain, teamDomain, adminDomain },
          reason,
        }),
      });
      const data = (await res.json()) as McsUpdateTenantSettingsResponse & {
        error?: string;
      };
      if (!data.ok) {
        setErr(data.error ?? 'Settings save failed.');
        setState('error');
        return;
      }
      onSaved(data.settings);
      setReason('');
      setState('saved');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
      setState('error');
    }
  };

  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-mono tracking-label text-[10px] text-gold uppercase">
            Master settings
          </p>
          <h2 className="font-display text-[24px] leading-none mt-1">Tenant</h2>
        </div>
        <p className="font-mono text-[11px] text-cream-mute">
          {settings.updatedAt
            ? `Updated ${new Date(settings.updatedAt).toLocaleString()}`
            : 'Code default'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Tenant name" value={tenantName} onChange={setTenantName} />
        <Field label=".com domain" value={publicComDomain} onChange={setPublicComDomain} />
        <Field label=".team domain" value={teamDomain} onChange={setTeamDomain} />
        <Field label="Admin domain" value={adminDomain} onChange={setAdminDomain} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <Field label="Reason" value={reason} onChange={setReason} />
        <Button type="button" variant="primary" size="md" onClick={() => void save()} disabled={!canSave}>
          {state === 'saving' ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
      {err && <p className="font-mono text-[12px] text-red-400 mt-3">{err}</p>}
      {state === 'saved' && (
        <p className="font-mono text-[12px] text-teal mt-3">Settings saved and audited.</p>
      )}
    </section>
  );
}

function TemplatePanel({
  overview,
  onSaved,
}: {
  overview: McsTenantOverview;
  onSaved: (template: McsTenantTemplateVersion) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<McsTenantTemplateKey>(
    overview.templates[0]?.templateKey ?? 'com.presentation.hero',
  );
  const selected = overview.templates.find((t) => t.templateKey === selectedKey);
  const definition = overview.templateDefinitions.find((t) => t.templateKey === selectedKey);
  const [content, setContent] = useState(selected?.content ?? '');
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState<McsTenantComplianceValidation | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setContent(selected?.content ?? '');
    setReason('');
    setValidation(null);
    setState('idle');
    setErr(null);
  }, [selected?.templateKey, selected?.content]);

  const tokenText = useMemo(
    () => (definition?.tokens.length ? definition.tokens.join('  ') : 'No tokens'),
    [definition],
  );

  const validate = async () => {
    if (!selected) return;
    setErr(null);
    try {
      const res = await fetch('/api/admin/tenant/templates/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surface: selected.surface, content }),
      });
      const data = (await res.json()) as McsValidateTenantTemplateResponse & {
        error?: string;
      };
      if (!data.ok) {
        setErr(data.error ?? 'Validation failed.');
        return;
      }
      setValidation(data.validation);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
    }
  };

  const save = async () => {
    if (!selected) return;
    setState('saving');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/tenant/templates/${selected.templateKey}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, reason }),
      });
      const data = (await res.json()) as McsSaveTenantTemplateResponse & {
        error?: string;
        validation?: McsTenantComplianceValidation;
      };
      if (!data.ok) {
        if (data.validation) setValidation(data.validation);
        setErr(data.error ?? 'Template save failed.');
        setState('error');
        return;
      }
      onSaved(data.template);
      setValidation(data.validation);
      setReason('');
      setState('saved');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
      setState('error');
    }
  };

  if (!selected || !definition) return null;

  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-mono tracking-label text-[10px] text-gold uppercase">
            Template control
          </p>
          <h2 className="font-display text-[24px] leading-none mt-1">
            Master content
          </h2>
        </div>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value as McsTenantTemplateKey)}
          className="bg-ink border border-line rounded-md px-3 h-10 text-sm text-cream focus:outline-none focus:border-gold"
        >
          {overview.templates.map((template) => (
            <option key={template.templateKey} value={template.templateKey}>
              {template.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            className="w-full bg-ink border border-line rounded-md p-3 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
          />
          <Field label="Reason" value={reason} onChange={setReason} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => void validate()}>
              Validate
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void save()}
              disabled={state === 'saving' || reason.trim().length === 0}
            >
              {state === 'saving' ? 'Saving...' : 'Save template'}
            </Button>
          </div>
          {err && <p className="font-mono text-[12px] text-red-400">{err}</p>}
          {state === 'saved' && (
            <p className="font-mono text-[12px] text-teal">
              Template saved, compliance-checked, and audited.
            </p>
          )}
        </div>

        <aside className="border border-line rounded-md p-3 text-[12px] text-cream-mute space-y-3">
          <Meta label="Surface" value={selected.surface} />
          <Meta label="Source" value={selected.source} />
          <Meta label="Version" value={String(selected.version)} />
          <Meta label="Tokens" value={tokenText} />
          <Meta label="Purpose" value={definition.description} />
          {validation && <ValidationBox validation={validation} />}
        </aside>
      </div>
    </section>
  );
}

function RolesPanel({ overview }: { overview: McsTenantOverview }) {
  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40 overflow-x-auto">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-1">
        Role / permission
      </p>
      <h2 className="font-display text-[24px] leading-none mb-4">Permission Map</h2>
      <table className="w-full text-[12px] min-w-[760px]">
        <thead>
          <tr className="border-b border-line text-cream-faint font-mono tracking-label uppercase">
            <th className="text-left py-2 pr-3">Role</th>
            {overview.roleMatrix[0]?.permissions.map((p) => (
              <th key={p.permission} className="text-center py-2 px-2">
                {p.permission.split('.').slice(-1)[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overview.roleMatrix.map((row) => (
            <tr key={row.role} className="border-b border-line/40 last:border-b-0">
              <td className="py-2 pr-3">
                <p className="text-cream">{row.label}</p>
                <p className="text-cream-mute">{row.description}</p>
              </td>
              {row.permissions.map((p) => (
                <td key={p.permission} className="text-center px-2 py-2 font-mono">
                  <span className={p.allowed ? 'text-teal' : 'text-cream/25'}>
                    {p.allowed ? 'YES' : '-'}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function InheritancePanel({ overview }: { overview: McsTenantOverview }) {
  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-1">
        Content inheritance
      </p>
      <h2 className="font-display text-[24px] leading-none mb-4">Layers</h2>
      <div className="space-y-3">
        {overview.inheritance.map((layer) => (
          <div key={layer.order} className="border border-line rounded-md p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-cream">
                {layer.order}. {layer.layer}
              </p>
              <span className="font-mono text-[10px] tracking-label uppercase text-cream-faint">
                {layer.canOverride ? 'override' : 'locked'}
              </span>
            </div>
            <p className="text-[12px] text-cream-mute mt-1">{layer.owner}</p>
            <p className="text-[12px] text-cream-mute mt-2">{layer.purpose}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompliancePanel({ overview }: { overview: McsTenantOverview }) {
  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-1">
        Compliance mapping
      </p>
      <h2 className="font-display text-[24px] leading-none mb-4">
        Save-Time Enforcement
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {overview.compliance.severityMapping.map((row) => (
          <div key={row.action} className="border border-line rounded-md p-3">
            <p className="font-mono text-[11px] tracking-label uppercase text-gold">
              {row.action} / {row.severity}
            </p>
            <p className="text-[13px] text-cream-mute mt-2">{row.meaning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-mono tracking-label text-[10px] text-cream-faint uppercase mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-ink border border-line rounded-md px-3 h-10 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
      />
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono tracking-label text-[10px] uppercase text-cream-faint">
        {label}
      </p>
      <p className="text-cream mt-0.5 break-words">{value}</p>
    </div>
  );
}

function ValidationBox({ validation }: { validation: McsTenantComplianceValidation }) {
  return (
    <div
      className={[
        'border rounded-md p-3',
        validation.ok ? 'border-teal/40 bg-teal/[0.04]' : 'border-red-400/40 bg-red-400/[0.04]',
      ].join(' ')}
    >
      <p
        className={[
          'font-mono tracking-label text-[10px] uppercase',
          validation.ok ? 'text-teal' : 'text-red-400',
        ].join(' ')}
      >
        {validation.ok ? 'Validation passed' : 'Validation blocked'}
      </p>
      {validation.issues.length === 0 ? (
        <p className="text-[12px] text-cream-mute mt-2">No issues found.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {validation.issues.map((issue) => (
            <li key={`${issue.ruleId}-${issue.matchedText ?? ''}`}>
              <p className="text-[12px] text-cream">{issue.message}</p>
              {issue.matchedText && (
                <p className="font-mono text-[11px] text-cream-mute">
                  Match: {issue.matchedText}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
