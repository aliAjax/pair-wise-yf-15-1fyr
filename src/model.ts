import type {
  BaseEvent,
  ChainEvent,
  CollectEvent,
  IdentifyEvent,
  ReceiveEvent,
  ReviewEvent,
  ReturnEvent,
  Sample,
  SignEvent,
  StageIndex,
} from "./types";

export const STORAGE_KEY = "forensic-entomology-coc-v1";
export const LAST_OPERATOR_KEY = "forensic-entomology-coc-operator";

/** 冷链温度上限（℃），超过即锁入待复核 */
export const TEMP_LIMIT = 8;

export const STAGES: { index: StageIndex; name: string; short: string }[] = [
  { index: 0, name: "采集登记", short: "采集" },
  { index: 1, name: "接收登记", short: "接收" },
  { index: 2, name: "鉴定登记", short: "鉴定" },
  { index: 3, name: "结论签发", short: "签发" },
];

export const DEVELOPMENT_STAGES = [
  "卵",
  "一龄幼虫",
  "二龄幼虫",
  "三龄幼虫",
  "后三龄（漫游期）幼虫",
  "蛹",
  "成虫",
];

export const EXPOSURE_STAGES = [
  "新鲜期",
  "肿胀期",
  "腐烂期",
  "后腐烂期",
  "白骨化期",
];

export const PRESERVATIONS = [
  "75%乙醇浸泡",
  "95%乙醇浸泡",
  "4℃冷藏",
  "-20℃冷冻",
  "干样干燥保存",
  "活体饲养",
  "福尔马林固定",
];

export const METHODS = ["形态学鉴定", "分子测序（COI）", "形态学 + 分子测序"];
export const CONFIDENCE = ["确定", "可能", "待补证"];

/* ---------------------------------------------------------------- helpers */

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** 当前时间，转成本地 datetime-local 字符串（秒） */
export function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDT(s: string | undefined): string {
  if (!s) return "—";
  return s.replace("T", " ").slice(0, 19);
}

export const activeEvents = (s: Sample): ChainEvent[] =>
  s.events.filter((e) => !e.superseded);

export function findActive<T extends ChainEvent["type"]>(
  s: Sample,
  type: T
): Extract<ChainEvent, { type: T }> | undefined {
  return [...s.events]
    .reverse()
    .find((e): e is Extract<ChainEvent, { type: T }> =>
      e.type === type ? !e.superseded : false
    );
}

/* ----------------------------------------------------- 状态与失效原因派生 */

/** 当前有效接收记录触发的失效原因（空数组 = 无异常） */
export function failureReasons(s: Sample): string[] {
  const collect = findActive(s, "collect");
  const receive = findActive(s, "receive");
  if (!receive) return [];
  const reasons: string[] = [];
  if (receive.temp > TEMP_LIMIT) {
    reasons.push(
      `接收温度 ${receive.temp}℃ 超过 ${TEMP_LIMIT}℃ 冷链上限`
    );
  }
  if (collect && receive.preservation !== collect.preservation) {
    reasons.push(
      `保存方式与原始记录不一致（原始：${collect.preservation}；接收：${receive.preservation}）`
    );
  }
  return reasons;
}

/** 是否存在有效异常 */
export const hasViolation = (s: Sample): boolean =>
  failureReasons(s).length > 0;

/** 最近一次复核结果：true 通过 / false 未通过 / undefined 未复核 */
export function lastReviewPass(s: Sample): boolean | undefined {
  const r = [...s.events]
    .reverse()
    .find(
      (e): e is ReviewEvent => e.type === "review" && !e.superseded
    );
  return r ? r.pass : undefined;
}

/**
 * 是否锁在待复核：存在有效异常，且最近一次有效复核未通过（未复核也算锁定）。
 */
export function isLocked(s: Sample): boolean {
  if (!hasViolation(s)) return false;
  return lastReviewPass(s) !== true;
}

/**
 * 当前已到达的环节索引（0 采集 / 1 接收 / 2 鉴定 / 3 签发）。
 * 取最远的有效登记；无采集登记时为 0。
 */
export function currentStage(s: Sample): StageIndex {
  if (findActive(s, "sign")) return 3;
  if (findActive(s, "identify")) return 2;
  if (findActive(s, "receive")) return 1;
  return 0;
}

/** 鉴定段内是否已登记、待签发 */
export const isIdentifiedPendingSign = (s: Sample): boolean =>
  !!findActive(s, "identify") && !findActive(s, "sign");

export type PhaseKey =
  | "collect"
  | "receive"
  | "identify"
  | "locked"
  | "signed";

/** 列表/详情使用的综合状态 */
export function phaseKey(s: Sample): PhaseKey {
  if (findActive(s, "sign")) return "signed";
  const stage = currentStage(s);
  if (stage === 0) {
    // 已采集登记、等待接收归入“待接收”；连采集都没有才是待采集
    return findActive(s, "collect") ? "receive" : "collect";
  }
  if (stage === 1) {
    // 已接收、等待鉴定登记；异常锁定优先提示
    return isLocked(s) ? "locked" : "identify";
  }
  // stage 2（已鉴定、待签发）：锁定则统一显示待复核
  if (isLocked(s)) return "locked";
  return "identify";
}

export const PHASE_META: Record<
  PhaseKey,
  { label: string; tone: "green" | "amber" | "blue" | "red" | "gray" }
> = {
  collect: { label: "待采集", tone: "gray" },
  receive: { label: "待接收", tone: "amber" },
  identify: { label: "待鉴定/签发", tone: "blue" },
  locked: { label: "待复核锁定", tone: "red" },
  signed: { label: "已签发", tone: "green" },
};

/* --------------------------------------------------------------- 可办理性 */

export const canCollect = (s: Sample): boolean => currentStage(s) === 0;
/** 接收：已完成有效采集、且尚无有效接收（含退回后重新接收） */
export const canReceive = (s: Sample): boolean =>
  !!findActive(s, "collect") && !findActive(s, "receive");
/**
 * 鉴定登记：已完成有效接收、尚未签发即可办理（锁定时允许填写/更新拟稿，
 * 只是不能签发）；已登记未签发时允许更新。
 */
export const canIdentify = (s: Sample): boolean =>
  !!findActive(s, "receive") && !findActive(s, "sign");
/**
 * 签发前均可退回：接收段 → 采集段；鉴定段（含已登记待签发）→ 接收段。
 * 采集刚登记、尚未接收时不产生退回（无上一段可回）。
 */
export const canReturn = (s: Sample): boolean =>
  !findActive(s, "sign") && currentStage(s) >= 1;
export const canReview = (s: Sample): boolean => isLocked(s);
/** 签发要求：鉴定已登记 + 不在待复核锁定 */
export const canSign = (s: Sample): boolean =>
  isIdentifiedPendingSign(s) && !isLocked(s);

/* ------------------------------------------------------------- 不可变动作 */

function clone(s: Sample): Sample {
  return { ...s, events: s.events.map((e) => ({ ...e })) };
}

function markSuperseded(events: ChainEvent[], ids: Set<string>) {
  events.forEach((e) => {
    if (ids.has(e.id)) e.superseded = true;
  });
}

export interface RegisterInput {
  at: string;
  operator: string;
  note?: string;
}

export function registerCollect(
  s: Sample,
  data: RegisterInput & Omit<CollectEvent, keyof BaseEvent | "type">
): Sample {
  if (!canCollect(s)) return s;
  const next = clone(s);
  next.events.push({
    id: uid("ev-col"),
    type: "collect",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    location: data.location,
    envTemp: data.envTemp,
    exposure: data.exposure,
    collectedAt: data.collectedAt,
    preservation: data.preservation,
  });
  return next;
}

export function registerReceive(
  s: Sample,
  data: RegisterInput & Omit<ReceiveEvent, keyof BaseEvent | "type">
): Sample {
  if (!canReceive(s)) return s;
  const next = clone(s);
  next.events.push({
    id: uid("ev-rec"),
    type: "receive",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    temp: data.temp,
    preservation: data.preservation,
    lab: data.lab,
  });
  return next;
}

export function registerIdentify(
  s: Sample,
  data: RegisterInput & Omit<IdentifyEvent, keyof BaseEvent | "type">
): Sample {
  if (!canIdentify(s)) return s;
  const next = clone(s);
  next.events.push({
    id: uid("ev-id"),
    type: "identify",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    method: data.method,
    conclusion: data.conclusion,
    confidence: data.confidence,
  });
  return next;
}

export function signConclusion(
  s: Sample,
  data: RegisterInput & { conclusionText: string }
): Sample {
  if (!canSign(s)) return s;
  const next = clone(s);
  const ev: SignEvent = {
    id: uid("ev-sign"),
    type: "sign",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    conclusionText: data.conclusionText,
  };
  next.events.push(ev);
  return next;
}

/**
 * 退回：从当前段（接收/鉴定）回到上一段，必填原因。
 * 作废目标段及之后的全部有效记录（含复核/签发），链中保留可追溯。
 */
export function returnToPrevious(
  s: Sample,
  data: RegisterInput & { reason: string }
): Sample {
  if (!canReturn(s)) return s;
  const stage = currentStage(s);
  // stage 1 = 接收段退回采集段；stage 2 = 鉴定段退回接收段
  const fromStage = (stage === 1 ? 1 : 2) as 1 | 2;
  const targetStage: StageIndex = fromStage === 1 ? 0 : 1;

  const next = clone(s);
  // 退回采集段：连原始采集记录一起作废需重新办理；退回接收段：保留采集
  const typeFloor: ChainEvent["type"][] =
    targetStage === 0
      ? ["receive", "identify", "sign", "review"]
      : ["identify", "sign", "review", "receive"];
  const floor = new Set(typeFloor);

  const supersededIds: string[] = [];
  next.events.forEach((e) => {
    if (floor.has(e.type) && !e.superseded) {
      supersededIds.push(e.id);
    }
  });
  markSuperseded(
    next.events,
    new Set(supersededIds)
  );

  const ev: ReturnEvent = {
    id: uid("ev-ret"),
    type: "return",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    fromStage,
    reason: data.reason,
    supersededIds,
  };
  next.events.push(ev);
  return next;
}

/** 复核：通过则放开锁定；不通过继续锁定。 */
export function reviewSample(
  s: Sample,
  data: RegisterInput & { pass: boolean }
): Sample {
  if (!canReview(s)) return s;
  const next = clone(s);
  // 旧的有效复核记录留痕，随时间轴保留（用 superseded 标记被新复核取代）
  next.events.forEach((e) => {
    if (e.type === "review" && !e.superseded) e.superseded = true;
  });
  const ev: ReviewEvent = {
    id: uid("ev-rev"),
    type: "review",
    at: data.at,
    operator: data.operator,
    note: data.note,
    superseded: false,
    pass: data.pass,
    reasons: failureReasons(s),
  };
  next.events.push(ev);
  return next;
}

/* ----------------------------------------------------------- 编号与持久化 */

/** 根据案件号及已有样本，建议下一个样本编号后缀字母 */
export function suggestSampleId(caseNo: string, samples: Sample[]): string {
  const used = new Set(
    samples
      .filter((x) => x.caseNo === caseNo)
      .map((x) => x.id.slice(caseNo.length + 1))
  );
  for (let i = 0; i < 26; i += 1) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return `${caseNo}-${letter}`;
  }
  return `${caseNo}-${used.size + 1}`;
}

export function loadSamples(): Sample[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Sample[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSamples(samples: Sample[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* 存储不可用时静默降级为内存态 */
  }
}

export function loadLastOperator(): string {
  try {
    return localStorage.getItem(LAST_OPERATOR_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveLastOperator(name: string): void {
  try {
    localStorage.setItem(LAST_OPERATOR_KEY, name);
  } catch {
    /* ignore */
  }
}
