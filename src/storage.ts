import {
  addEvent,
  createSample,
  registerStage,
  returnStage,
  reviewHold,
  type NewSampleInput,
} from "./chain";
import type { Sample } from "./types";

type SeedDef = NewSampleInput;

const seedDefs: SeedDef[] = [
  {
    caseId: "CASE-042-A",
    species: "丝光绿蝇 Lucilia sericata",
    growthStage: "幼虫",
    location: "城东废弃工地 · 室外草地",
    sampledAt: "2026-09-18T09:30",
    note: "三龄幼虫，用于PMI推断",
    originalTemp: 18.4,
    originalPreservation: "75%乙醇浸存",
    collector: "李铭（现场勘查）",
    collectTime: "2026-09-18T10:05",
  },
  {
    caseId: "CASE-042-B",
    species: "红头丽蝇 Calliphora vicina",
    growthStage: "蛹",
    location: "城东废弃工地 · 阴影区域",
    sampledAt: "2026-09-18T09:45",
    note: "蛹期样本，需复核种属",
    originalTemp: 17.9,
    originalPreservation: "4℃冷藏",
    collector: "李铭（现场勘查）",
    collectTime: "2026-09-18T10:12",
  },
  {
    caseId: "CASE-051-A",
    species: "大头金蝇 Chrysomya megacephala",
    growthStage: "成虫",
    location: "西郊水沟边缘",
    sampledAt: "2026-09-15T16:20",
    note: "成虫网捕，已完成拍照存档",
    originalTemp: 22.1,
    originalPreservation: "干制标本",
    collector: "王蕾（现场勘查）",
    collectTime: "2026-09-15T16:40",
  },
  {
    caseId: "CASE-053-A",
    species: "厩腐蝇 Muscina stabulans",
    growthStage: "卵",
    location: "南区垃圾转运站",
    sampledAt: "2026-09-22T08:10",
    note: "卵块连基质整体保存",
    originalTemp: 6.2,
    originalPreservation: "4℃冷藏",
    collector: "赵启（现场勘查）",
    collectTime: "2026-09-22T08:35",
  },
  {
    caseId: "CASE-055-A",
    species: "赤颈郭公虫 Necrobia rufipes",
    growthStage: "幼虫",
    location: "北郊仓库室内",
    sampledAt: "2026-09-24T11:00",
    note: "包装破损后补采",
    originalTemp: 20.5,
    originalPreservation: "无水乙醇浸存",
    collector: "陈璐（现场勘查）",
    collectTime: "2026-09-24T11:30",
  },
];

export function buildSeedSamples(): Sample[] {
  // CASE-042-A：接收温度超标锁定 → 复核通过 → 完成鉴定 → 已签发
  let a = createSample(seedDefs[0]);
  a = registerStage(a, "receipt", {
    handler: "周倩（物证接收）",
    time: "2026-09-18T14:50",
    temperature: 9.6,
    preservation: "75%乙醇浸存",
  });
  a = reviewHold(a, a.holds[0].id, "孙德海（复核人）", true);
  a = registerStage(a, "identification", {
    handler: "何静（昆虫学鉴定）",
    time: "2026-09-19T10:20",
    temperature: 5.1,
    preservation: "75%乙醇浸存",
    conclusion: "丝光绿蝇三龄幼虫，最短发育时间约 56 小时",
  });
  a = sign(a, "何静（昆虫学鉴定）");

  // CASE-042-B：接收后保存方式与原始记录不符，当前锁在待复核
  const b0 = createSample(seedDefs[1]);
  const b = registerStage(b0, "receipt", {
    handler: "周倩（物证接收）",
    time: "2026-09-18T15:02",
    temperature: 4.0,
    preservation: "75%乙醇浸存",
  });

  // CASE-051-A：全链正常，已签发
  let c = createSample(seedDefs[2]);
  c = registerStage(c, "receipt", {
    handler: "周倩（物证接收）",
    time: "2026-09-15T18:30",
    temperature: 7.4,
    preservation: "干制标本",
  });
  c = registerStage(c, "identification", {
    handler: "何静（昆虫学鉴定）",
    time: "2026-09-16T09:15",
    temperature: 6.8,
    preservation: "干制标本",
    conclusion: "大头金蝇成虫，形态特征与标本拍照一致",
  });
  c = sign(c, "何静（昆虫学鉴定）");

  // CASE-053-A：接收段退回采集段（包装无标签），待采集重新办理
  let d = createSample(seedDefs[3]);
  d = returnStage(d, "receipt", "周倩（物证接收）", "样本容器无唯一性标签，无法确认与原始记录对应，退回补充标识与封装。");

  // CASE-055-A：刚采集完成，等待接收
  const e = createSample(seedDefs[4]);

  return [a, b, c, d, e];
}

function sign(sample: Sample, handler: string): Sample {
  const time = "2026-09-19T11:00";
  addEvent(sample, "sign", "identification", handler, time, "鉴定结论签发");
  return sample;
}

const STORAGE_KEY = "forensic-entomology-chain-v1";

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
    // 存储不可用时静默降级为内存态
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
