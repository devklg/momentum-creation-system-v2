import { verifyPoolPositioningGraph } from '../src/qa/poolPositioningGraphVerification.js';
import { closeMongo, connectMongo } from '../src/services/persistence/mongo/connection.js';
import { closeNeo4j } from '../src/services/persistence/neo4j/connection.js';

try {
  await connectMongo();
  const report = await verifyPoolPositioningGraph();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'clear') process.exitCode = 2;
} finally {
  await Promise.all([closeMongo(), closeNeo4j()]);
}
