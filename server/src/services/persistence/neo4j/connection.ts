/**
 * Neo4j direct connection (S1.3 Phase 0, ACR-0007 / Option C).
 * Direct via neo4j-driver — no ORM. Singleton driver; sessions are per-operation.
 * Opened only when Neo4j is in direct mode (see flags.ts / index.ts boot).
 */
import neo4j, { type Driver } from 'neo4j-driver';
import { env } from '../../../env.js';

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      env.NEO4J_URI,
      neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
      {
        connectionAcquisitionTimeout: env.NEO4J_CONNECTION_TIMEOUT_MS,
        connectionTimeout: env.NEO4J_CONNECTION_TIMEOUT_MS,
        maxTransactionRetryTime: env.NEO4J_QUERY_TIMEOUT_MS,
      },
    );
  }
  return driver;
}

/** Open + verify the connection. Call at boot when Neo4j is in direct mode. */
export async function connectNeo4j(): Promise<void> {
  await getNeo4jDriver().verifyConnectivity();
}

/** Health probe — true iff the driver can reach the database. */
export async function neo4jHealth(): Promise<boolean> {
  try {
    await getNeo4jDriver().verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

/** Graceful shutdown. */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
