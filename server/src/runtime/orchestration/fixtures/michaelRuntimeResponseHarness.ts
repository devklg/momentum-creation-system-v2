import { validateMichaelResponseContract } from '../michaelResponseContract.js';
import type {
  MichaelRuntimeResponseFixtureHarness,
  MichaelRuntimeResponseFixtureHarnessResult,
  MichaelRuntimeResponseFixtureScenarioName,
  MichaelRuntimeResponseFixtureScenarioOptions,
} from '../types.js';
import {
  michaelResponseFixtures,
  type MichaelResponseFixtureKey,
} from './michaelResponseFixtures.js';
import { getMichaelRuntimeResponseScenario } from './michaelRuntimeResponseScenarios.js';
import { runRuntimeTurnFixtureScenario } from './runtimeTurnHarness.js';

export function createMichaelRuntimeResponseFixtureHarness(): MichaelRuntimeResponseFixtureHarness {
  return {
    runScenario(options) {
      return runMichaelRuntimeResponseFixtureScenario(options);
    },
  };
}

export async function runMichaelRuntimeResponseFixtureScenario(
  options: MichaelRuntimeResponseFixtureScenarioOptions,
): Promise<MichaelRuntimeResponseFixtureHarnessResult> {
  const scenario = getMichaelRuntimeResponseScenario(options.scenarioName);
  const runtimeTurn = await runRuntimeTurnFixtureScenario({
    scenario: scenario.metadata.runtimeScenario,
    agentKey: scenario.metadata.agentKey,
    taskType: scenario.metadata.taskType,
    createdAt: options.createdAt,
  });
  const michaelResponse = selectValidatedMichaelResponseFixture(
    options.scenarioName,
    scenario.responseFixtureKey,
  );

  return {
    scenarioName: options.scenarioName,
    scenario,
    runtimeTurn,
    michaelResponse: michaelResponse.contract,
    validation: michaelResponse,
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    responsePersistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };
}

function selectValidatedMichaelResponseFixture(
  scenarioName: MichaelRuntimeResponseFixtureScenarioName,
  responseFixtureKey: string,
): Extract<ReturnType<typeof validateMichaelResponseContract>, { ok: true }> {
  const fixture =
    michaelResponseFixtures[responseFixtureKey as MichaelResponseFixtureKey];
  if (!fixture) {
    throw new Error(
      `Missing Michael response contract fixture ${responseFixtureKey} for ${scenarioName}.`,
    );
  }

  const validation = validateMichaelResponseContract(fixture);
  if (!validation.ok) {
    throw new Error(
      `Invalid Michael response contract fixture ${responseFixtureKey} for ${scenarioName}: ${validation.issues
        .map((issue) => `${issue.path}:${issue.code}`)
        .join(', ')}`,
    );
  }

  return validation;
}
