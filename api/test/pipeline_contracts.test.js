import test from "node:test";
import assert from "node:assert/strict";

import {
  PipelineStage,
  PipelineRollbackCoordinator,
  validateSchemaEvolution,
  validateStageTransition,
} from "../coach/pipeline_contracts.js";

test("validateSchemaEvolution accepts compliant payloads across versions", () => {
  const v1Payload = {
    lifterHandle: "user_123",
    plan: { routines: [] },
    history: [],
    progressionPolicy: "linear",
  };
  const res1 = validateSchemaEvolution(v1Payload, "v1");
  assert.equal(res1.valid, true);

  const v3Payload = {
    lifterHandle: "user_456",
    plan: { routines: [] },
    history: [],
    cadence: "weekly",
    equipment: ["barbell", "bench"],
    progressionPolicy: "wave_periodization",
  };
  const res3 = validateSchemaEvolution(v3Payload, "v3");
  assert.equal(res3.valid, true);
});

test("validateSchemaEvolution rejects missing required fields and disallowed policies", () => {
  assert.throws(() => validateSchemaEvolution(null, "v1"), /non-null object/);
  assert.throws(() => validateSchemaEvolution([], "v1"), /non-null object/);

  // Missing equipment in v3
  const missingEquipment = {
    lifterHandle: "user_123",
    plan: {},
    history: [],
    cadence: "weekly",
  };
  assert.throws(() => validateSchemaEvolution(missingEquipment, "v3"), /missing required field 'equipment'/);

  // Disallowed policy for v1
  const invalidPolicyForV1 = {
    lifterHandle: "user_123",
    plan: {},
    history: [],
    progressionPolicy: "wave_periodization",
  };
  assert.throws(() => validateSchemaEvolution(invalidPolicyForV1, "v1"), /not permitted under schema v1/);
});

test("validateStageTransition asserts strictly sequential pipeline stage order", () => {
  assert.equal(validateStageTransition(PipelineStage.INGESTION, PipelineStage.AGGREGATION), true);
  assert.equal(validateStageTransition(PipelineStage.AGGREGATION, PipelineStage.ANALYSIS), true);

  // Illegal skip
  assert.throws(
    () => validateStageTransition(PipelineStage.INGESTION, PipelineStage.PLAN_MUTATION),
    /Illegal stage jump/
  );

  // Backward transition
  assert.throws(
    () => validateStageTransition(PipelineStage.ANALYSIS, PipelineStage.INGESTION),
    /Illegal stage jump/
  );

  // Invalid stage
  assert.throws(() => validateStageTransition("UNKNOWN", PipelineStage.AGGREGATION), /Invalid source pipeline stage/);
});

test("PipelineRollbackCoordinator executes compensations in reverse LIFO order on abort", async () => {
  const coordinator = new PipelineRollbackCoordinator({ executionId: "test_run_1" });
  const compensationTrace = [];

  coordinator.registerStep(PipelineStage.AGGREGATION, () => {
    compensationTrace.push("UNWIND_AGGREGATION");
  });

  coordinator.registerStep(PipelineStage.ANALYSIS, () => {
    compensationTrace.push("UNWIND_ANALYSIS");
  });

  coordinator.registerStep(PipelineStage.PLAN_MUTATION, () => {
    compensationTrace.push("UNWIND_PLAN_MUTATION");
  });

  assert.equal(coordinator.status, "RUNNING");

  // Simulate verification failure triggering transactional rollback
  const result = await coordinator.rollback(new Error("Plan verification failed: duplicate routine"));

  assert.equal(result.success, true);
  assert.equal(coordinator.status, "ROLLED_BACK");

  // Verify reverse LIFO execution: MUTATION -> ANALYSIS -> AGGREGATION
  assert.deepEqual(compensationTrace, [
    "UNWIND_PLAN_MUTATION",
    "UNWIND_ANALYSIS",
    "UNWIND_AGGREGATION",
  ]);

  // Reject further steps on rolled-back coordinator
  assert.throws(
    () => coordinator.registerStep(PipelineStage.VERIFICATION, () => {}),
    /Cannot register step on already rolled-back/
  );
});

test("PipelineRollbackCoordinator captures individual compensation errors without halting unwind", async () => {
  const coordinator = new PipelineRollbackCoordinator();
  const successfulTraces = [];

  coordinator.registerStep(PipelineStage.AGGREGATION, () => {
    successfulTraces.push("AGGREGATION_CLEANED");
  });

  coordinator.registerStep(PipelineStage.ANALYSIS, () => {
    throw new Error("Compensation network timeout");
  });

  coordinator.registerStep(PipelineStage.PLAN_MUTATION, () => {
    successfulTraces.push("MUTATION_CLEANED");
  });

  const result = await coordinator.rollback(new Error("Abort"));
  assert.equal(result.success, false);
  assert.equal(result.compensationErrors.length, 1);
  assert.equal(result.compensationErrors[0].stage, PipelineStage.ANALYSIS);
  assert.ok(result.compensationErrors[0].error.includes("Compensation network timeout"));

  // Ensures other compensations still completed
  assert.deepEqual(successfulTraces, ["MUTATION_CLEANED", "AGGREGATION_CLEANED"]);
});
