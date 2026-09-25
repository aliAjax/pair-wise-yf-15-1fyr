import type { ChainEvent, GrowthStage, Hold, Sample, StageId, StageLog } from "./types";

export const STAGE_ORDER: StageId[] = ["collection", "receipt", "identification"];

export const STAGE_LABEL: Record<StageId, string> = {
  collection: "采集",
  receipt: "接收",
  identification: "鉴定登记",
};

export const GROWTH_STAGES: GrowthStage[] = ["卵", "幼虫", "蛹", "成虫"];

export const PRESERVATION_OPTIONS = [
  "75%乙醇浸存",
  "无水乙醇浸存",
  "4℃冷藏",
  "-20℃冷冻",
  "干制标本",
  "活体饲养",
];

/** 管控阈值：温度超过 8℃ 即失效 */
export const TEMP_LIMIT = 8;

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function stageIndex(stage: StageId): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * 失效原因：实测温度超过 8℃，或保存方式与原始记录不一致。
 */
export function findViolations(
  sample: Pick<Sample, "originalTemp" | "originalPreservation">,
  temp?: number,
  preservation?: string,
): string[] {
  const reasons: string[] = [];
  if (typeof temp === "number" && Number.isFinite(temp) && temp > TEMP_LIMIT) {
    reasons.push(`实测温度 ${temp}℃ 超过 ${TEMP_LIMIT}℃（原始记录 ${sample.originalTemp}℃）`);
  }
  if (preservation && preservation !== sample.originalPreservation) {
    reasons.push(
      `保存方式与原始记录不一致：原始「${sample.originalPreservation}」，实际「${preservation}」`,
    );
  }
  return reasons;
}

export function hasOpenHold(sample: Sample): boolean {
  return sample.holds.some((h) => h.status === "pending");
}

export function isSigned(sample: Sample): boolean {
  return sample.events.some((e) => e.kind === "sign");
}

export type SampleStatus = "atCollection" | "atReceipt" | "atIdentification" | "holding" | "signed";

export function getStatus(sample: Sample): SampleStatus {
  if (isSigned(sample)) return "signed";
  if (hasOpenHold(sample)) return "holding";
  if (sample.currentStage === "identification") return "atIdentification";
  if (sample.currentStage === "receipt") return "atReceipt";
  return "atCollection";
}

export const STATUS_META: Record<
  SampleStatus,
  { label: string; tone: "neutral" | "warn" | "danger" | "ok" | "progress" }
> = {
  atCollection: { label: "待接收", tone: "neutral" },
  atReceipt: { label: "待鉴定", tone: "progress" },
  atIdentification: { label: "待签发", tone: "progress" },
  holding: { label: "待复核（锁定）", tone: "danger" },
  signed: { label: "鉴定结论已签发", tone: "ok" },
};

export function addEvent(
  sample: Sample,
  kind: ChainEvent["kind"],
  stage: StageId,
  handler: string,
  time: string,
  detail?: string,
): ChainEvent {
  const event: ChainEvent = { id: uid("evt"), kind, stage, handler, time, detail };
  sample.events.push(event);
  return event;
}

function openHolds(sample: Sample): Hold[] {
  return sample.holds.filter((h) => h.status === "pending");
}

function lock(sample: Sample, stage: StageId, reasons: string[], time: string) {
  const hold: Hold = { id: uid("hold"), stage, reasons, raisedAt: time, status: "pending" };
  sample.holds.push(hold);
  addEvent(
    sample,
    "hold",
    stage,
    "系统",
    time,
    `样本锁入待复核：${reasons.join("；")}`,
  );
}

export interface NewSampleInput {
  caseId: string;
  species: string;
  growthStage: GrowthStage;
  location: string;
  sampledAt: string;
  note: string;
  originalTemp: number;
  originalPreservation: string;
  collector: string; // 采集经办人
  collectTime: string;
}

export function createSample(input: NewSampleInput): Sample {
  const sample: Sample = {
    id: uid("smp"),
    caseId: input.caseId.trim(),
    species: input.species.trim(),
    growthStage: input.growthStage,
    location: input.location.trim(),
    sampledAt: input.sampledAt,
    note: input.note.trim(),
    originalTemp: input.originalTemp,
    originalPreservation: input.originalPreservation,
    // 采集登记随建档一并完成，样本流转至接收段
    currentStage: "receipt",
    logs: {
      collection: { handler: input.collector.trim(), time: input.collectTime },
    },
    holds: [],
    events: [],
    createdAt: nowLocal(),
  };
  addEvent(sample, "collect", "collection", input.collector.trim(), input.collectTime, "采集段登记完成");
  return sample;
}

export class RuleError extends Error {}

/**
 * 办理当前交接段：
 * - 只能办理样本当前停留的段（前一段未完成/已退回，后一段不能办理）；
 * - 采集段重新提交后流转到接收；接收段登记后流转到鉴定；
 * - 接收段或鉴定段发现温度/保存异常 => 锁入待复核，不推进；
 * - 鉴定段存在未结失效时，鉴定结论不能签发（不允许办理）。
 */
export function registerStage(sample: Sample, stage: StageId, log: StageLog): Sample {
  const s = structuredClone(sample);
  if (isSigned(s)) {
    throw new RuleError("鉴定结论已签发，样本流程已完结，不能再办理。");
  }
  if (s.currentStage !== stage) {
    throw new RuleError(
      `前一段「${STAGE_LABEL[s.currentStage]}」尚未完成，不能办理「${STAGE_LABEL[stage]}」段。`,
    );
  }
  if (hasOpenHold(s)) {
    throw new RuleError("样本处于待复核锁定状态，复核通过前不能办理交接。");
  }

  s.logs[stage] = { ...log };

  if (stage === "collection") {
    addEvent(s, "collect", stage, log.handler, log.time, "采集段重新提交");
    s.currentStage = "receipt";
    return s;
  }

  if (stage === "receipt") {
    addEvent(s, "advance", stage, log.handler, log.time, "接收段登记完成，样本移交鉴定");
    const violations = findViolations(s, log.temperature, log.preservation);
    if (violations.length > 0) {
      lock(s, "receipt", violations, nowLocal());
      return s; // 停留在接收段，锁定待复核
    }
    s.currentStage = "identification";
    return s;
  }

  // identification
  addEvent(s, "advance", stage, log.handler, log.time, `鉴定登记完成：${log.conclusion ?? ""}`.trim());
  const violations = findViolations(s, log.temperature, log.preservation);
  if (violations.length > 0) {
    lock(s, "identification", violations, nowLocal());
    return s;
  }
  s.currentStage = "identification"; // 等待签发
  return s;
}

/**
 * 退回：必须填写原因，回到上一段。
 * 当前段（被退回到的目标段）登记记录清除，需重新办理；历史事件保留。
 */
export function returnStage(sample: Sample, fromStage: StageId, handler: string, reason: string): Sample {
  const s = structuredClone(sample);
  if (isSigned(s)) {
    throw new RuleError("鉴定结论已签发，不能退回。");
  }
  if (s.currentStage !== fromStage) {
    throw new RuleError("只能从样本当前所在段发起退回。");
  }
  const idx = stageIndex(fromStage);
  if (idx === 0) {
    throw new RuleError("采集是首段，不能再向前退回。");
  }
  if (!handler.trim()) {
    throw new RuleError("退回必须填写经办人。");
  }
  if (!reason.trim()) {
    throw new RuleError("退回必须填写原因。");
  }
  const time = nowLocal();
  const target = STAGE_ORDER[idx - 1];
  delete s.logs[fromStage];
  s.currentStage = target;
  addEvent(
    s,
    "return",
    fromStage,
    handler.trim(),
    time,
    `退回至「${STAGE_LABEL[target]}」段。原因：${reason.trim()}`,
  );
  return s;
}

/**
 * 复核：待复核样本经复核人通过后放开，交接方可继续；
 * 复核不通过则保持锁定。
 */
export function reviewHold(sample: Sample, holdId: string, reviewer: string, passed: boolean): Sample {
  const s = structuredClone(sample);
  const hold = s.holds.find((h) => h.id === holdId);
  if (!hold || hold.status !== "pending") {
    throw new RuleError("没有可复核的待处理失效记录。");
  }
  const time = nowLocal();
  if (!passed) {
    addEvent(s, "hold", hold.stage, reviewer.trim(), time, "复核未通过，样本继续锁定待复核");
    return s;
  }
  hold.status = "passed";
  hold.reviewer = reviewer.trim();
  hold.reviewedAt = time;
  // 接收段锁定经复核放开后，样本继续移交鉴定
  if (hold.stage === "receipt" && s.currentStage === "receipt") {
    s.currentStage = "identification";
  }
  addEvent(
    s,
    "release",
    hold.stage,
    reviewer.trim(),
    time,
    `复核通过，样本解除锁定。失效原因：${hold.reasons.join("；")}`,
  );
  return s;
}

/**
 * 签发鉴定结论：仅鉴定段、无未结失效、已完成鉴定登记时可办理。
 */
export function signConclusion(sample: Sample, handler: string): Sample {
  const s = structuredClone(sample);
  if (isSigned(s)) throw new RuleError("鉴定结论已签发。");
  if (s.currentStage !== "identification") throw new RuleError("样本尚未到达鉴定段。");
  if (openHolds(s).length > 0) {
    throw new RuleError("存在温度/保存方式失效记录，鉴定结论不能签发，须复核通过后放开。");
  }
  if (!s.logs.identification) throw new RuleError("请先完成鉴定登记。");
  addEvent(s, "sign", "identification", handler.trim(), nowLocal(), "鉴定结论签发");
  return s;
}

export function nextSampleNumber(existing: Sample[]): number {
  const nums = existing
    .map((s) => Number(s.caseId.split("-")[1]))
    .filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 41) + 1;
}
