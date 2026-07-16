import type { VmProviderKey } from '../../domain/vmProviderQueue.js';
import { VM_PROVIDER_MAX_COOLDOWN_MS } from './types.js';

export interface VmProviderThrottleSnapshot {
  provider: VmProviderKey;
  inFlight: number;
  lastStartedAt: string | null;
  cooldownUntil: string | null;
  throttledCount: number;
}

interface ProviderState {
  inFlight: number;
  lastStartedAt: number | null;
  cooldownUntil: number;
  throttledCount: number;
}

type WaitReason = 'rate_gap' | 'provider_cooldown' | 'concurrency';

export class VmProviderThrottle {
  private readonly states = new Map<VmProviderKey, ProviderState>();
  private globalLastStartedAt: number | null = null;

  constructor(
    private readonly ratePerMinute: () => number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> =
      (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  getAvailability(provider: VmProviderKey): {
    allowed: boolean;
    waitMs: number;
    availableAt: string;
    reason: WaitReason | null;
  } {
    const at = this.now();
    const state = this.state(provider);
    if (state.cooldownUntil > at) {
      return this.unavailable(state.cooldownUntil - at, 'provider_cooldown', at);
    }
    if (state.inFlight >= 1) {
      return this.unavailable(1, 'concurrency', at);
    }
    const gapMs = Math.ceil(60_000 / this.ratePerMinute());
    const eligibleAt = Math.max(
      this.globalLastStartedAt === null ? at : this.globalLastStartedAt + gapMs,
      state.lastStartedAt === null ? at : state.lastStartedAt + gapMs,
    );
    if (eligibleAt > at) {
      return this.unavailable(eligibleAt - at, 'rate_gap', at);
    }
    return {
      allowed: true,
      waitMs: 0,
      availableAt: new Date(at).toISOString(),
      reason: null,
    };
  }

  async run<T>(provider: VmProviderKey, operation: () => Promise<T>): Promise<T> {
    while (true) {
      const availability = this.getAvailability(provider);
      if (availability.allowed) break;
      if (availability.reason === 'provider_cooldown') {
        throw new Error('provider_cooldown_active');
      }
      this.state(provider).throttledCount += 1;
      await this.sleep(availability.waitMs);
    }

    const state = this.state(provider);
    const startedAt = this.now();
    state.inFlight += 1;
    state.lastStartedAt = startedAt;
    this.globalLastStartedAt = startedAt;
    try {
      return await operation();
    } finally {
      state.inFlight = Math.max(0, state.inFlight - 1);
    }
  }

  applyCooldown(provider: VmProviderKey, retryAfterMs: number | null): string {
    const boundedMs = Math.min(
      VM_PROVIDER_MAX_COOLDOWN_MS,
      Math.max(30_000, retryAfterMs ?? 30_000),
    );
    const state = this.state(provider);
    state.cooldownUntil = Math.max(
      state.cooldownUntil,
      this.now() + boundedMs,
    );
    state.throttledCount += 1;
    return new Date(state.cooldownUntil).toISOString();
  }

  snapshot(): VmProviderThrottleSnapshot[] {
    return [...this.states.entries()].map(([provider, state]) => ({
      provider,
      inFlight: state.inFlight,
      lastStartedAt:
        state.lastStartedAt !== null
          ? new Date(state.lastStartedAt).toISOString()
          : null,
      cooldownUntil:
        state.cooldownUntil > this.now()
          ? new Date(state.cooldownUntil).toISOString()
          : null,
      throttledCount: state.throttledCount,
    }));
  }

  resetForTest(): void {
    this.states.clear();
    this.globalLastStartedAt = null;
  }

  private unavailable(waitMs: number, reason: WaitReason, at: number) {
    const safeWait = Math.max(1, Math.ceil(waitMs));
    return {
      allowed: false,
      waitMs: safeWait,
      availableAt: new Date(at + safeWait).toISOString(),
      reason,
    };
  }

  private state(provider: VmProviderKey): ProviderState {
    const existing = this.states.get(provider);
    if (existing) return existing;
    const created: ProviderState = {
      inFlight: 0,
      lastStartedAt: null,
      cooldownUntil: 0,
      throttledCount: 0,
    };
    this.states.set(provider, created);
    return created;
  }
}
