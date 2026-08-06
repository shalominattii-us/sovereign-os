import {
  ACTION_STATES,
  COMMERCIAL_ROUTE_STATUSES,
  INTELLIGENCE_POLICY_VERSION,
  PRIORITIES,
  TREASURY_HANDOFF_STATUSES,
  VALIDATION_STATUS,
} from "./constants.js";
import { isoTimestamp } from "./canonical.js";
import { InputValidationError } from "./errors.js";

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function validatePolicy(policy) {
  if (!policy || policy.version !== INTELLIGENCE_POLICY_VERSION) {
    throw new InputValidationError("Intelligence policy version is unsupported", {
      expected: INTELLIGENCE_POLICY_VERSION,
      received: policy?.version ?? null,
    });
  }
  const weights = policy.weights ?? {};
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);
  if (Math.abs(total - 1) > 0.000001) {
    throw new InputValidationError("Intelligence policy weights must sum to 1", { total });
  }
  return true;
}

function sectorFit(record, policy) {
  const searchable = `${record.sector ?? ""} ${record.title ?? ""}`.toLowerCase();
  const matches = policy.sector_alignment
    .filter((entry) => entry.keywords.some((keyword) => searchable.includes(keyword.toLowerCase())))
    .map((entry) => entry.score);
  const score = matches.length > 0 ? Math.max(...matches) : policy.defaults.sector_fit;
  return {
    score: clamp(score),
    explanation: matches.length > 0
      ? `Sector taxonomy matched at ${score}/100.`
      : `No configured sector keyword matched; policy default ${score}/100 applied.`,
  };
}

function strategicAlignment(record, policy) {
  const declaredTier = record.intelligence?.input_signals?.declared_strategic_tier
    ?? record.strategic_fit?.tier
    ?? "Unassessed";
  const declaredPriority = record.intelligence?.input_signals?.declared_priority
    ?? record.priority
    ?? "UNPRIORITIZED";
  const tierScore = policy.strategic_tier_scores[declaredTier] ?? policy.defaults.strategic_signal;
  const priorityScore = policy.priority_signal_scores[declaredPriority] ?? policy.defaults.strategic_signal;
  return {
    score: roundOne((tierScore + priorityScore) / 2),
    declaredTier,
    declaredPriority,
    explanation: `Declared tier ${declaredTier} contributed ${tierScore}; declared priority ${declaredPriority} contributed ${priorityScore}.`,
  };
}

function adjustedBaselines(record, policy) {
  const baseline = policy.type_baselines[record.type];
  if (!baseline) throw new InputValidationError("No intelligence baseline exists for opportunity type", { type: record.type });
  const procurement = policy.procurement_adjustments[record.procurement_type] ?? {};
  const temporal = policy.temporal_adjustments[record.temporal_status] ?? {};
  return {
    revenue_probability: clamp(
      baseline.revenue_probability
      + (procurement.revenue_probability ?? 0)
      + (temporal.revenue_probability ?? 0),
    ),
    funding_probability: clamp(
      baseline.funding_probability
      + (procurement.funding_probability ?? 0)
      + (temporal.funding_probability ?? 0),
    ),
    implementation_complexity: baseline.implementation_complexity
      + (procurement.implementation_complexity ?? 0)
      + (temporal.implementation_complexity ?? 0),
    explanation: [
      `Type baseline applied for ${record.type}.`,
      record.procurement_type && policy.procurement_adjustments[record.procurement_type]
        ? `Procurement adjustment applied for ${record.procurement_type}.`
        : "No procurement-type adjustment applied.",
      `Temporal adjustment applied for ${record.temporal_status}.`,
    ],
  };
}

function implementationComplexity(record, baseline, policy) {
  const rules = policy.complexity_rules;
  let adjustment = 0;
  adjustment += Math.min(record.eligibility?.length ?? 0, 5) * rules.per_eligibility_item;
  adjustment += Math.min(record.compliance_requirements?.length ?? 0, 5) * rules.per_compliance_item;
  adjustment += Math.min(record.registration_requirements?.length ?? 0, 5) * rules.per_registration_item;
  if (record.jurisdiction && !/^(united states|u\.s\.|usa)$/i.test(record.jurisdiction)) {
    adjustment += rules.international_jurisdiction;
  }
  if (/partnership|consortium/i.test(record.revenue_path ?? "")) {
    adjustment += rules.consortium_or_partnership;
  }
  adjustment = Math.min(adjustment, rules.maximum_adjustment);
  return {
    score: clamp(baseline + adjustment),
    explanation: `Delivery requirements added ${adjustment} complexity points to the type baseline.`,
  };
}

function recommendedPriority(score, policy) {
  if (score >= policy.priority_thresholds.P0) return PRIORITIES.P0;
  if (score >= policy.priority_thresholds.P1) return PRIORITIES.P1;
  return PRIORITIES.P2;
}

function resetCommercialization() {
  return {
    status: COMMERCIAL_ROUTE_STATUSES.NOT_EVALUATED,
    policy_version: null,
    candidate_paths: [],
    primary_path: null,
    rationale: [],
    evaluated_at: null,
    treasury_labs_handoff: {
      status: TREASURY_HANDOFF_STATUSES.NOT_EVALUATED,
      reason: "commercialization routing must be reevaluated after scoring",
    },
  };
}

function resetAuthorization(authorization) {
  return {
    ...authorization,
    status: "PENDING",
    approved_action: null,
    authorization_id: null,
    authorized_by: null,
    authorized_at: null,
    expires_at: null,
    review_snapshot_hash: null,
    artifact_hash: null,
  };
}

export function scoreOpportunity(record, policy, {
  timestamp = isoTimestamp(),
  actor = "system:strategic-intelligence",
} = {}) {
  validatePolicy(policy);
  if (record.validation?.status !== VALIDATION_STATUS.VERIFIED) {
    throw new InputValidationError("Strategic scoring requires a strictly VERIFIED opportunity", {
      record_id: record.id,
      validation_status: record.validation?.status ?? null,
    });
  }

  const sector = sectorFit(record, policy);
  const strategic = strategicAlignment(record, policy);
  const baselines = adjustedBaselines(record, policy);
  const complexity = implementationComplexity(record, baselines.implementation_complexity, policy);
  const dimensions = {
    sector_fit: roundOne(sector.score),
    revenue_probability: roundOne(baselines.revenue_probability),
    funding_probability: roundOne(baselines.funding_probability),
    implementation_complexity: roundOne(complexity.score),
    strategic_alignment: roundOne(strategic.score),
  };
  const score = roundOne(
    dimensions.sector_fit * policy.weights.sector_fit
    + dimensions.revenue_probability * policy.weights.revenue_probability
    + dimensions.funding_probability * policy.weights.funding_probability
    + (100 - dimensions.implementation_complexity) * policy.weights.implementation_feasibility
    + dimensions.strategic_alignment * policy.weights.strategic_alignment,
  );
  const priority = recommendedPriority(score, policy);
  const priorState = record.action_state;
  const nextState = ACTION_STATES.STRATEGIC_MATCHED;

  const updated = {
    ...record,
    intelligence: {
      status: "SCORED",
      policy_version: policy.version,
      methodology: "deterministic_weighted_policy",
      input_signals: {
        declared_strategic_tier: strategic.declaredTier,
        declared_priority: strategic.declaredPriority,
      },
      dimensions,
      weights: { ...policy.weights },
      score,
      recommended_priority: priority,
      explanation: [
        sector.explanation,
        ...baselines.explanation,
        complexity.explanation,
        strategic.explanation,
        "The score is a deterministic policy heuristic, not a statistically calibrated probability.",
      ],
      scored_at: timestamp,
    },
    strategic_score: score,
    revenue_probability: dimensions.revenue_probability / 100,
    priority,
    commercialization: resetCommercialization(),
    action_state: nextState,
    updated_at: timestamp,
  };

  if (priorState !== nextState) {
    updated.state_history = [
      ...(record.state_history ?? []),
      {
        from: priorState,
        to: nextState,
        at: timestamp,
        actor,
        reason: "deterministic strategic intelligence score completed",
      },
    ];
  }
  if (record.authorization?.status === "AUTHORIZED" || priorState === ACTION_STATES.AUTHORIZED_ACTION) {
    updated.authorization = resetAuthorization(record.authorization);
    updated.state_history = [
      ...(updated.state_history ?? []),
      {
        from: nextState,
        to: nextState,
        at: timestamp,
        actor,
        reason: "rescoring invalidated prior human authorization",
      },
    ];
  }
  return updated;
}
