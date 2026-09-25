import type { Sample } from "./types";

/** 在当前时间基础上偏移的时间戳，保证演示数据位于“今天”附近 */
function offset(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let n = 0;
const id = (p: string) => `${p}-seed-${(n += 1)}`;

/** 首次打开时写入的演示台账，覆盖各分支状态 */
export function buildSeedSamples(): Sample[] {
  const samples: Sample[] = [
    // 1. 已签发的正常样本（全链路，无异常）
    {
      id: "CASE-042-A",
      caseNo: "CASE-042",
      species: "丝光绿蝇 Lucilia sericata",
      stage: "三龄幼虫",
      createdAt: offset(-4320),
      events: [
        {
          id: id("c"),
          type: "collect",
          at: offset(-4320),
          operator: "现场勘查员 王磊",
          location: "城郊废弃草地 · 尸体口鼻腔",
          envTemp: 21.4,
          exposure: "肿胀期",
          collectedAt: offset(-4330),
          preservation: "75%乙醇浸泡",
          superseded: false,
          note: "分两份，A 份乙醇、B 份活体",
        },
        {
          id: id("r"),
          type: "receive",
          at: offset(-4200),
          operator: "物证管理员 李颖",
          temp: 5.2,
          preservation: "75%乙醇浸泡",
          lab: "法医昆虫学实验室 · 冷藏柜2",
          superseded: false,
        },
        {
          id: id("i"),
          type: "identify",
          at: offset(-2880),
          operator: "鉴定人 周明",
          method: "形态学鉴定",
          conclusion: "丝光绿蝇三龄幼虫，口钩、后气门形态吻合",
          confidence: "确定",
          superseded: false,
        },
        {
          id: id("s"),
          type: "sign",
          at: offset(-1440),
          operator: "授权签字人 陈洁",
          conclusionText: "鉴定结论成立：丝光绿蝇三龄幼虫，可用于PMI推算",
          superseded: false,
        },
      ],
    },

    // 2. 接收段温度超 8℃，锁在待复核（尚未复核）
    {
      id: "CASE-042-B",
      caseNo: "CASE-042",
      species: "大头金蝇 Chrysomya megacephala",
      stage: "蛹",
      createdAt: offset(-2880),
      events: [
        {
          id: id("c"),
          type: "collect",
          at: offset(-2880),
          operator: "现场勘查员 王磊",
          location: "城郊废弃草地 · 尸体下方土壤 3cm",
          envTemp: 22.1,
          exposure: "腐烂期",
          collectedAt: offset(-2890),
          preservation: "4℃冷藏",
          superseded: false,
        },
        {
          id: id("r"),
          type: "receive",
          at: offset(-2760),
          operator: "物证管理员 李颖",
          temp: 11.8,
          preservation: "4℃冷藏",
          lab: "法医昆虫学实验室 · 周转台",
          superseded: false,
          note: "运输冰袋已融化，复测两次均偏高",
        },
      ],
    },

    // 3. 保存方式与原始记录不一致，已复核未通过，继续锁定
    {
      id: "CASE-051-A",
      caseNo: "CASE-051",
      species: "绯颜裸金蝇 Achoetandrus rufifacies",
      stage: "二龄幼虫",
      createdAt: offset(-1500),
      events: [
        {
          id: id("c"),
          type: "collect",
          at: offset(-1500),
          operator: "现场勘查员 赵航",
          location: "水沟边树荫下 · 尸体衣着内",
          envTemp: 26.7,
          exposure: "后腐烂期",
          collectedAt: offset(-1510),
          preservation: "95%乙醇浸泡",
          superseded: false,
        },
        {
          id: id("r"),
          type: "receive",
          at: offset(-1380),
          operator: "物证管理员 李颖",
          temp: 6.4,
          preservation: "75%乙醇浸泡",
          lab: "法医昆虫学实验室 · 冷藏柜1",
          superseded: false,
        },
        {
          id: id("i"),
          type: "identify",
          at: offset(-900),
          operator: "鉴定人 周明",
          method: "形态学 + 分子测序",
          conclusion: "疑似绯颜裸金蝇二龄幼虫，COI待出",
          confidence: "待补证",
          superseded: false,
        },
        {
          id: id("v"),
          type: "review",
          at: offset(-600),
          operator: "复核人 陈洁",
          pass: false,
          reasons: ["保存方式与原始记录不一致（原始：95%乙醇浸泡；接收：75%乙醇浸泡）"],
          superseded: false,
          note: "浓度变化可能影响后续分子结果，要求补充保存差异说明后再复核",
        },
      ],
    },

    // 4. 采集后尚未接收（演示顺序门槛：接收前鉴定不可办）
    {
      id: "CASE-051-B",
      caseNo: "CASE-051",
      species: "家蝇 Musca domestica",
      stage: "成虫",
      createdAt: offset(-300),
      events: [
        {
          id: id("c"),
          type: "collect",
          at: offset(-300),
          operator: "现场勘查员 赵航",
          location: "水沟边 · 尸体周围扫网",
          envTemp: 27.9,
          exposure: "白骨化期",
          collectedAt: offset(-305),
          preservation: "干样干燥保存",
          superseded: false,
        },
      ],
    },

    // 5. 温度+保存方式双异常，复核通过后已解锁，鉴定已登记待签发
    {
      id: "CASE-088-A",
      caseNo: "CASE-088",
      species: "厩腐蝇 Muscina stabulans",
      stage: "后三龄（漫游期）幼虫",
      createdAt: offset(-7000),
      events: [
        {
          id: id("c"),
          type: "collect",
          at: offset(-7000),
          operator: "现场勘查员 孙倩",
          location: "林间土路 · 尸体周边 1m 落叶层",
          envTemp: 18.2,
          exposure: "后腐烂期",
          collectedAt: offset(-7010),
          preservation: "4℃冷藏",
          superseded: false,
        },
        {
          id: id("r"),
          type: "receive",
          at: offset(-6880),
          operator: "物证管理员 李颖",
          temp: 9.6,
          preservation: "活体饲养",
          lab: "法医昆虫学实验室 · 养虫室",
          superseded: false,
          note: "为发育积温观测改为活体饲养，转运过程短时升温",
        },
        {
          id: id("v"),
          type: "review",
          at: offset(-6000),
          operator: "复核人 陈洁",
          pass: true,
          reasons: [
            "接收温度 9.6℃ 超过 8℃ 冷链上限",
            "保存方式与原始记录不一致（原始：4℃冷藏；接收：活体饲养）",
          ],
          superseded: false,
          note: "已核验升温时长小于30分钟且改为活体饲养属鉴定方案要求，附情况说明，同意继续",
        },
        {
          id: id("i"),
          type: "identify",
          at: offset(-4000),
          operator: "鉴定人 周明",
          method: "形态学鉴定",
          conclusion: "厩腐蝇后三龄漫游期幼虫，特征稳定",
          confidence: "确定",
          superseded: false,
        },
      ],
    },

    // 6. 已退回样本（鉴定段退回接收段，原始接收记录作废留痕），重新接收仍异常待复核
    (() => {
      const cId = id("c");
      const r1Id = id("r1");
      const i1Id = id("i1");
      return {
        id: "CASE-042-C",
        caseNo: "CASE-042",
        species: "巨尾阿丽蝇 Aldrichina grahami",
        stage: "卵",
        createdAt: offset(-9000),
        events: [
          {
            id: cId,
            type: "collect",
            at: offset(-9000),
            operator: "现场勘查员 王磊",
            location: "城郊废弃草地 · 尸体眼周",
            envTemp: 19.6,
            exposure: "新鲜期",
            collectedAt: offset(-9005),
            preservation: "75%乙醇浸泡",
            superseded: false,
          },
          {
            id: r1Id,
            type: "receive",
            at: offset(-8880),
            operator: "物证管理员 （代班）",
            temp: 12.4,
            preservation: "75%乙醇浸泡",
            lab: "法医昆虫学实验室",
            superseded: true,
            note: "首次接收未复测",
          },
          {
            id: i1Id,
            type: "identify",
            at: offset(-8000),
            operator: "鉴定人 周明",
            method: "形态学鉴定",
            conclusion: "初判阿丽蝇属卵块（该登记随退回作废）",
            confidence: "可能",
            superseded: true,
          },
          {
            id: id("t"),
            type: "return",
            at: offset(-7600),
            operator: "授权签字人 陈洁",
            fromStage: 2 as const,
            reason:
              "首次接收温度 12.4℃ 超冷链上限且鉴定依据不足，退回接收段重新核对温控与保存状态",
            supersededIds: [r1Id, i1Id],
            superseded: false,
          },
          {
            id: id("r2"),
            type: "receive",
            at: offset(-7200),
            operator: "物证管理员 李颖",
            temp: 8.9,
            preservation: "75%乙醇浸泡",
            lab: "法医昆虫学实验室 · 冷藏柜2",
            superseded: false,
            note: "重新接收，温度复测 8.9℃ 仍略高，待复核",
          },
        ],
      } as Sample;
    })(),
  ];

  return samples;
}
