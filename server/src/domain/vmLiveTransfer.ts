/**
 * VM live-transfer owner availability — the fail-closed gate for the second
 * dialer model (dialMode 'live_transfer' / 'both').
 *
 * A bridge to the owner's phone may ONLY be attempted when the owner has
 * explicitly marked themselves available AND configured a transfer-to
 * number. No record, available=false, or a missing number all mean "not
 * available" — the dialer then falls back (both → leave the voicemail) or
 * refuses to dial at all (live_transfer), never manufacturing dead air.
 *
 * This is deliberately VM-local (tmag_vm_transfer_availability keyed by
 * ownerTmagId). The three-way-call scheduler (tmag_sponsor_availability)
 * models weekly windows for booking, which does not fit a binary
 * "am I holding my phone right now" pilot switch, and the CRM model is
 * owned by Codex and must not be extended from this lane.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { normalizeVmPhone, vmAudit } from './vmProviderQueue.js';
import type { McsVmTransferAvailabilityRecord } from '@momentum/shared';

const MONGO_DB = 'momentum';
const AVAILABILITY_COLLECTION = 'tmag_vm_transfer_availability';
const CHROMA_COLLECTION = 'mcs_vm_campaigns';

export class VmLiveTransferError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VmLiveTransferError';
  }
}

function availabilityId(ownerTmagId: string): string {
  return `vmavail_${ownerTmagId}`;
}

/**
 * Fail-closed read: absence of a record means NOT available.
 */
export async function getTransferAvailability(
  ownerTmagId: string,
): Promise<McsVmTransferAvailabilityRecord> {
  const result = await persistenceCall<{ documents: McsVmTransferAvailabilityRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId },
      limit: 1,
    },
  );
  const doc = result.documents?.[0];
  if (!doc) {
    return {
      ownerTmagId,
      available: false,
      transferToNumber: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
  return {
    ownerTmagId,
    available: doc.available === true && Boolean(doc.transferToNumber),
    transferToNumber: doc.transferToNumber ?? null,
    updatedAt: doc.updatedAt,
  };
}

export async function setTransferAvailability(input: {
  ownerTmagId: string;
  available: boolean;
  transferToNumber: string | null;
}): Promise<McsVmTransferAvailabilityRecord> {
  const normalized = input.transferToNumber
    ? normalizeVmPhone(input.transferToNumber)
    : null;
  if (input.transferToNumber && !normalized) {
    throw new VmLiveTransferError('invalid_transfer_number');
  }
  // Fail closed: marking available without a number is not a usable state.
  if (input.available && !normalized) {
    throw new VmLiveTransferError('transfer_number_required');
  }

  const updatedAt = new Date().toISOString();
  const id = availabilityId(input.ownerTmagId);
  const record: McsVmTransferAvailabilityRecord = {
    ownerTmagId: input.ownerTmagId,
    available: input.available,
    transferToNumber: normalized,
    updatedAt,
  };

  const existing = await persistenceCall<{ documents: Array<{ ownerTmagId: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId: input.ownerTmagId },
      limit: 1,
    },
  );

  if (existing.documents?.[0]) {
    // mongodb.update does not honor upsert — branch on existence.
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId: input.ownerTmagId },
      update: {
        $set: {
          available: record.available,
          transferToNumber: record.transferToNumber,
          updatedAt,
        },
      },
    });
    await persistenceCall('neo4j', 'cypher', {
      query:
        'MERGE (a:TmagVmTransferAvailability {ownerTmagId: $ownerTmagId}) ' +
        'SET a.available = $available, a.transferToNumber = $transferToNumber, a.updatedAt = $updatedAt',
      params: {
        ownerTmagId: record.ownerTmagId,
        available: record.available,
        transferToNumber: record.transferToNumber,
        updatedAt,
      },
    });
  } else {
    await writeOperational({
      id,
      mongoCollection: AVAILABILITY_COLLECTION,
      mongoDoc: { ...record },
      neo4j: {
        cypher:
          'MERGE (a:TmagVmTransferAvailability {ownerTmagId: $ownerTmagId}) ' +
          'SET a.available = $available, a.transferToNumber = $transferToNumber, a.updatedAt = $updatedAt',
        params: {
          ownerTmagId: record.ownerTmagId,
          available: record.available,
          transferToNumber: record.transferToNumber,
          updatedAt,
        },
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document:
          `VM live-transfer availability for ${record.ownerTmagId}: ` +
          `${record.available ? 'available' : 'unavailable'} at ${updatedAt}.`,
        metadata: {
          kind: 'vm_transfer_availability',
          ownerTmagId: record.ownerTmagId,
          available: record.available,
          updatedAt,
        },
      },
    });
  }

  // Read back — the gate must be provably on disk before any bridge relies on it.
  const readBack = await persistenceCall<{ documents: McsVmTransferAvailabilityRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId: input.ownerTmagId },
      limit: 1,
    },
  );
  if (!readBack.documents?.[0]) throw new VmLiveTransferError('availability_readback_failed');

  await vmAudit({
    action: 'vm.live_transfer.availability_set',
    entityId: id,
    ownerTmagId: input.ownerTmagId,
    summary:
      `Owner ${input.ownerTmagId} set live-transfer availability to ` +
      `${record.available ? 'AVAILABLE' : 'UNAVAILABLE'}.`,
    payload: { available: record.available, hasTransferNumber: Boolean(record.transferToNumber) },
  });

  return record;
}
