import { verifySponsorImmutabilityGraph } from '../src/qa/sponsorImmutabilityGraphVerification.js';
import { closeNeo4j } from '../src/services/persistence/neo4j/connection.js';

try {
  const report = await verifySponsorImmutabilityGraph();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'clear') process.exitCode = 2;
} finally {
  await closeNeo4j();
}
