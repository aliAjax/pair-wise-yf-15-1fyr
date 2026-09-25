export type StageId = "collection" | "receipt" | "identification";

export type GrowthStage = "卵" | "幼虫" | "蛹" | "成虫";

/** 某一交接段的登记信息（经办人 + 时间，接收/鉴定段附带温度与保存方式） */
export interface StageLog {
  handler: string;
  time: string; // datetime-local 格式
  temperature?: number; // 该段实测样本温度 ℃
  preservation?: string; // 该段实际保存方式
  conclusion?: string; // 鉴定段结论
}

export type EventKind =
  | "collect" // 采集登记 / 重新提交
  | "advance" // 接收交接完成
  | "return" // 退回（带原因）
  | "hold" // 锁定待复核
  | "release" // 复核通过
  | "sign"; // 鉴定结论签发

export interface ChainEvent {
  id: string;
  kind: EventKind;
  stage: StageId;
  handler: string;
  time: string;
  detail?: string;
}

/** 失效记录：温度超标或保存方式与原始记录不一致时产生 */
export interface Hold {
  id: string;
  stage: StageId;
  reasons: string[];
  raisedAt: string;
  status: "pending" | "passed";
  reviewer?: string;
  reviewedAt?: string;
}

export interface Sample {
  id: string;
  caseId: string; // 案件编号
  species: string; // 昆虫种类
  growthStage: GrowthStage; // 发育阶段
  location: string; // 采样地点
  sampledAt: string; // 采样时间
  note: string; // 鉴定/采样备注
  originalTemp: number; // 原始记录温度
  originalPreservation: string; // 原始保存方式
  /** 当前停留的交接段；前一段未完成时后一段不可办理 */
  currentStage: StageId;
  logs: Partial<Record<StageId, StageLog>>;
  holds: Hold[];
  events: ChainEvent[];
  createdAt: string;
}
