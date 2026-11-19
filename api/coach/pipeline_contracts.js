/**
 * Strict Pipeline Stage Contracts, Schema Evolution Validator,
 * and Transactional Rollback Coordinator for Coach Training Plans.
 */

export const PipelineStage = Object.freeze({
  INGESTION: "INGESTION",
  AGGREGATION: "AGGREGATION",
  ANALYSIS: "ANALYSIS",
  PLAN_MUTATION: "PLAN_MUTATION",
  VERIFICATION: "VERIFICATION",
  COMMITTED: "COMMITTED",
});

const STAGE_ORDER = [
  PipelineStage.INGESTION,
  PipelineStage.AGGREGATION,
  PipelineStage.ANALYSIS,
  PipelineStage.PLAN_MUTATION,
  PipelineStage.VERIFICATION,
  PipelineStage.COMMITTED,
];

export const SCHEMA_REGISTRY = {
  v1: {
    requiredFields: ["lifterHandle", "plan", "history"],
    allowedProgressionPolicies: ["linear", "double_progression"],
  },
  v2: {
    requiredFields: ["lifterHandle", "plan", "history", "cadence"],
    allowedProgressionPolicies: ["linear", "double_progression", "rpe_autoregulated"],
  },
  v3: {
    requiredFields: ["lifterHandle", "plan", "history", "cadence", "equipment"],
    allowedProgressionPolicies: ["linear", "double_progression", "rpe_autoregulated", "wave_periodization"],
  },
};

/**
 * Validates payload schema conformity and backward compatibility across versions.
 */
export function validateSchemaEvolution(payload, targetVersion = "v3") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Payload must be a non-null object");
  }

  const schema = SCHEMA_REGISTRY[targetVersion];
  if (!schema) {
    throw new Error(`Unsupported schema target version: ${targetVersion}`);
  }

  // Check required fields
  for (const field of schema.requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      throw new Error(`Schema validation error for ${targetVersion}: missing required field '${field}'`);
    }
  }

  // Check progression policy if present
  if (payload.progressionPolicy !== undefined) {
    if (!schema.allowedProgressionPolicies.includes(payload.progressionPolicy)) {
      throw new Error(
        `Progression policy '${payload.progressionPolicy}' is not permitted under schema ${targetVersion}`
      );
    }
  }

  return {
    valid: true,
    version: targetVersion,
    validatedFields: schema.requiredFields,
  };
}

/**
 * Validates stage transition contracts and invariants.
 */
export function validateStageTransition(fromStage, toStage) {
  const fromIdx = STAGE_ORDER.indexOf(fromStage);
  const toIdx = STAGE_ORDER.indexOf(toStage);

  if (fromIdx === -1) {
    throw new Error(`Invalid source pipeline stage: ${fromStage}`);
  }
  if (toIdx === -1) {
    throw new Error(`Invalid destination pipeline stage: ${toStage}`);
  }

  if (toIdx !== fromIdx + 1) {
    throw new Error(`Illegal stage jump from ${fromStage} to ${toStage}; must advance strictly sequentially.`);
  }

  return true;
}

/**
 * Transactional Stage Coordinator with Reverse-LIFO Compensation Rollback.
 */
export class PipelineRollbackCoordinator {
  constructor(options = {}) {
    this.executionId = options.executionId || `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.currentStage = PipelineStage.INGESTION;
    this.history = [];
    this.compensations = [];
    this.status = "INITIALIZED";
    this.rollbackLog = [];
  }

  /**
   * Register a completed stage and its inverse compensation action.
   */
  registerStep(stage, compensationFn) {
    if (this.status === "ROLLED_BACK") {
      throw new Error("Cannot register step on already rolled-back coordinator");
    }
    if (typeof compensationFn !== "function") {
      throw new TypeError("Compensation action must be a callable function");
    }

    validateStageTransition(this.currentStage, stage);
    this.currentStage = stage;
    this.history.push({ stage, timestamp: Date.now() });
    this.compensations.push({ stage, rollback: compensationFn });
    this.status = stage === PipelineStage.COMMITTED ? "COMMITTED" : "RUNNING";
  }

  /**
   * Execute transactional rollback across all registered stages in reverse LIFO order.
   */
  async rollback(triggerError) {
    this.status = "ROLLED_BACK";
    const errors = [];
    const sanitizedTrigger = triggerError ? String(triggerError.message || triggerError) : "Pipeline validation abort";

    this.rollbackLog.push({
      action: "ROLLBACK_INITIATED",
      trigger: sanitizedTrigger,
      pendingCompensations: this.compensations.length,
      timestamp: Date.now(),
    });

    // Execute in reverse order (LIFO)
    while (this.compensations.length > 0) {
      const { stage, rollback } = this.compensations.pop();
      try {
        await rollback();
        this.rollbackLog.push({
          action: "STAGE_COMPENSATED",
          stage,
          success: true,
          timestamp: Date.now(),
        });
      } catch (compErr) {
        const compErrMsg = String(compErr.message || compErr);
        errors.push({ stage, error: compErrMsg });
        this.rollbackLog.push({
          action: "STAGE_COMPENSATION_FAILED",
          stage,
          error: compErrMsg,
          timestamp: Date.now(),
        });
      }
    }

    return {
      success: errors.length === 0,
      executionId: this.executionId,
      trigger: sanitizedTrigger,
      compensationErrors: errors,
      history: this.history,
      rollbackLog: this.rollbackLog,
    };
  }
}
