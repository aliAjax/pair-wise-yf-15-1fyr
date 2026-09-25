// 保管链台账数据模型

/** 环节索引：0 采集 / 1 接收 / 2 鉴定 / 3 签发 */
export type StageIndex = 0 | 1 | 2 | 3;

export interface BaseEvent {
  id: string;
  /** 经办时间（datetime-local 字符串，如 2026-09-22T09:10） */
  at: string;
  /** 经办人 */
  operator: string;
  /** 被退回作废后仍保留在链中，仅标记 */
  superseded: boolean;
  note?: string;
}

/** 采集登记（原始记录） */
export interface CollectEvent extends BaseEvent {
  type: "collect";
  location: string;
  /** 现场环境温度 ℃ */
  envTemp: number;
  /** 尸体暴露阶段 */
  exposure: string;
  /** 采样时间 */
  collectedAt: string;
  /** 原始保存方式 */
  preservation: string;
}

/** 接收登记 */
export interface ReceiveEvent extends BaseEvent {
  type: "receive";
  /** 接收时冷链温度 ℃（超过 8℃ 触发待复核） */
  temp: number;
  /** 当前保存方式（与原始记录不一致触发待复核） */
  preservation: string;
  /** 接收岗位 / 实验室 */
  lab?: string;
}

/** 鉴定登记 */
export interface IdentifyEvent extends BaseEvent {
  type: "identify";
  method: string;
  /** 鉴定结论（签发前为拟稿） */
  conclusion: string;
  confidence?: string;
}

/** 结论签发 */
export interface SignEvent extends BaseEvent {
  type: "sign";
  conclusionText: string;
}

/** 退回登记 */
export interface ReturnEvent extends BaseEvent {
  type: "return";
  /** 从哪一段退回：1 接收段 / 2 鉴定段 */
  fromStage: 1 | 2;
  reason: string;
  /** 本次退回作废的事件 id */
  supersededIds: string[];
}

/** 复核登记 */
export interface ReviewEvent extends BaseEvent {
  type: "review";
  pass: boolean;
  /** 复核时刻的失效原因快照 */
  reasons: string[];
}

export type ChainEvent =
  | CollectEvent
  | ReceiveEvent
  | IdentifyEvent
  | SignEvent
  | ReturnEvent
  | ReviewEvent;

export interface Sample {
  /** 样本编号，如 CASE-042-A */
  id: string;
  /** 案件编号，如 CASE-042 */
  caseNo: string;
  species: string;
  /** 发育阶段（具体阶段，如 三龄幼虫） */
  stage: string;
  createdAt: string;
  /** 只追加、不物理删除的保管链事件流 */
  events: ChainEvent[];
}
