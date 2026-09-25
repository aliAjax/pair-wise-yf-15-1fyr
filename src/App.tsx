import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Sample } from "./types";
import {
  canCollect,
  canIdentify,
  canReceive,
  canReturn,
  canReview,
  canSign,
  currentStage,
  findActive,
  formatDT,
  isLocked,
  loadLastOperator,
  loadSamples,
  PHASE_META,
  phaseKey,
  registerCollect,
  registerIdentify,
  registerReceive,
  returnToPrevious,
  reviewSample,
  saveLastOperator,
  saveSamples,
  signConclusion,
  TEMP_LIMIT,
  uid,
} from "./model";
import { buildSeedSamples } from "./seed";
import { Badge, Button } from "./components/ui";
import { SampleDetail, type ActionKey } from "./components/SampleDetail";
import {
  CollectForm,
  type CollectPayload,
  IdentifyForm,
  type IdentifyPayload,
  NewSampleForm,
  type NewSamplePayload,
  ReceiveForm,
  type ReceivePayload,
  ReturnForm,
  type ReturnPayload,
  ReviewForm,
  type ReviewPayload,
  SignForm,
  type SignPayload,
} from "./components/forms";
import { DEVELOPMENT_STAGES, nowLocal } from "./model";

type ModalKind =
  | "new"
  | "collect"
  | "receive"
  | "identify"
  | "sign"
  | "return"
  | "review";

type StatusFilter = "all" | "collect" | "receive" | "identify" | "locked" | "signed";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "collect", label: "待采集" },
  { value: "receive", label: "待接收" },
  { value: "identify", label: "待鉴定/签发" },
  { value: "locked", label: "待复核锁定" },
  { value: "signed", label: "已签发" },
];

function initSamples(): Sample[] {
  const stored = loadSamples();
  // null = 从未使用（播种演示数据）；[] 或有数据 = 用户数据，一律保留
  if (stored === null) {
    const seed = buildSeedSamples();
    saveSamples(seed);
    return seed;
  }
  return stored;
}

function App() {
  const [samples, setSamples] = useState<Sample[]>(initSamples);
  const [operator, setOperator] = useState<string>(loadLastOperator);

  // 筛选条件
  const [caseFilter, setCaseFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind | null>(null);

  // 持久化：记录重开页面后仍保留
  useEffect(() => {
    saveSamples(samples);
  }, [samples]);
  useEffect(() => {
    saveLastOperator(operator);
  }, [operator]);

  const caseOptions = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseNo))).sort(),
    [samples]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toUpperCase();
    return samples
      .filter((s) => caseFilter === "all" || s.caseNo === caseFilter)
      .filter((s) => stageFilter === "all" || s.stage === stageFilter)
      .filter((s) => statusFilter === "all" || phaseKey(s) === statusFilter)
      .filter(
        (s) =>
          !kw ||
          s.id.toUpperCase().includes(kw) ||
          s.species.toUpperCase().includes(kw) ||
          (findActive(s, "collect")?.location ?? "").toUpperCase().includes(kw)
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [samples, caseFilter, stageFilter, statusFilter, keyword]);

  const selected = samples.find((s) => s.id === selectedId) ?? null;

  const metrics = useMemo(() => {
    const locked = samples.filter((s) => isLocked(s)).length;
    const signed = samples.filter((s) => !!findActive(s, "sign")).length;
    // 待办理：尚未到达签发且未锁定（锁定样本需先复核，不计入常规待办）
    const pending = samples.filter(
      (s) => !findActive(s, "sign") && !isLocked(s)
    ).length;
    return {
      total: samples.length,
      locked,
      signed,
      pending,
    };
  }, [samples]);

  /* ----------------------------------------------------------- mutations */

  const updateSample = (id: string, fn: (s: Sample) => Sample) => {
    setSamples((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  };

  const rememberOperator = (name: string) => {
    if (name.trim()) setOperator(name.trim());
  };

  const handleNew = (p: NewSamplePayload) => {
    const s: Sample = {
      id: p.id,
      caseNo: p.caseNo,
      species: p.species,
      stage: p.stage,
      createdAt: nowLocal(),
      events: [
        {
          id: uid("ev-col"),
          type: "collect",
          at: p.at,
          operator: p.operator,
          note: p.note,
          superseded: false,
          location: p.location,
          envTemp: p.envTemp,
          exposure: p.exposure,
          collectedAt: p.collectedAt,
          preservation: p.preservation,
        },
      ],
    };
    setSamples((prev) => [s, ...prev]);
    rememberOperator(p.operator);
    setModal(null);
    setSelectedId(s.id);
    setCaseFilter("all");
  };

  const handleCollect = (p: CollectPayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => registerCollect(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const handleReceive = (p: ReceivePayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => registerReceive(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const handleIdentify = (p: IdentifyPayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => registerIdentify(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const handleSign = (p: SignPayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => signConclusion(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const handleReturn = (p: ReturnPayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => returnToPrevious(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const handleReview = (p: ReviewPayload) => {
    if (!selected) return;
    updateSample(selected.id, (s) => reviewSample(s, p));
    rememberOperator(p.operator);
    setModal(null);
  };

  const onAction = (key: ActionKey) => setModal(key);

  const resetDemo = () => {
    if (window.confirm("确定重置为演示台账？当前全部记录将被替换。")) {
      const seed = buildSeedSamples();
      setSamples(seed);
      setSelectedId(null);
    }
  };

  /* --------------------------------------------------------------- render */

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-row">
          <div>
            <p className="kicker">法医昆虫学 · 物证保管链台账</p>
            <h1>样本交接 Chain of Custody</h1>
            <span>
              采集 → 接收 → 鉴定 → 签发 顺序办理，经办人与时间逐段留痕；
              接收温度超过 {TEMP_LIMIT}℃ 或保存方式与原始记录不符即锁入待复核，
              复核通过后方可签发；退回须填原因并回到上一段，作废记录全程保留。
            </span>
          </div>
          <div className="hero-actions">
            <Button variant="primary" onClick={() => setModal("new")}>
              + 新建样本登记
            </Button>
            <Button onClick={resetDemo}>重置演示数据</Button>
          </div>
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>样本总数</small>
          <strong>{metrics.total}</strong>
        </article>
        <article className={metrics.locked ? "metric-alert" : ""}>
          <small>待复核锁定</small>
          <strong>{metrics.locked}</strong>
        </article>
        <article>
          <small>待办理环节</small>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <small>已签发结论</small>
          <strong>{metrics.signed}</strong>
        </article>
      </section>

      {selected ? (
        <section className="panel">
          <SampleDetail
            sample={
              samples.find((s) => s.id === selected.id) ?? selected
            }
            onAction={onAction}
            onClose={() => setSelectedId(null)}
          />
        </section>
      ) : (
        <>
          <section className="panel filters-panel">
            <div className="filters-line">
              <label className="filter-item">
                <span>案件</span>
                <select
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                >
                  <option value="all">全部案件</option>
                  {caseOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-item">
                <span>发育阶段</span>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                >
                  <option value="all">全部阶段</option>
                  {DEVELOPMENT_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-item">
                <span>状态</span>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-item grow">
                <span>搜索</span>
                <input
                  placeholder="样本编号 / 种类 / 采样地点"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </label>
            </div>
            <div className="chips quick-chips">
              <button
                className={stageFilter === "all" ? "chip-on" : ""}
                onClick={() => setStageFilter("all")}
              >
                全部阶段
              </button>
              {["卵", "三龄幼虫", "蛹", "成虫"].map((s) => (
                <button
                  key={s}
                  className={stageFilter === s ? "chip-on" : ""}
                  onClick={() => setStageFilter(stageFilter === s ? "all" : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p>保管链台账</p>
                <h2>
                  样本列表
                  <small className="count-tag">{filtered.length} / {samples.length}</small>
                </h2>
              </div>
            </div>

            <div className="table-wrap">
              <table className="coc-table">
                <thead>
                  <tr>
                    <th>样本 / 案件</th>
                    <th>种类 · 发育阶段</th>
                    <th>当前环节</th>
                    <th>接收温度 / 保存</th>
                    <th>最近经办人 · 时间</th>
                    <th>状态</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const phase = phaseKey(s);
                    const collect = findActive(s, "collect");
                    const receive = findActive(s, "receive");
                    const lastEvent = (() => {
                      const evs = s.events.filter(
                        (e) => e.type !== "return" && e.type !== "review"
                      );
                      return evs.length ? evs[evs.length - 1] : undefined;
                    })();
                    const locked = isLocked(s);
                    return (
                      <tr
                        key={s.id}
                        className={locked ? "row-locked" : ""}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td>
                          <b className="cell-id">{s.id}</b>
                          <small>{collect?.location ?? "未登记采集信息"}</small>
                        </td>
                        <td>
                          <span>{s.species}</span>
                          <small>{s.stage}</small>
                        </td>
                        <td>
                          <StageCell sample={s} />
                        </td>
                        <td>
                          {receive ? (
                            <>
                              <span
                                className={
                                  receive.temp > TEMP_LIMIT ? "temp-bad" : ""
                                }
                              >
                                {receive.temp}℃
                              </span>
                              <small>
                                {receive.preservation}
                                {collect &&
                                  receive.preservation !== collect.preservation && (
                                    <em className="mismatch">（与原始不符）</em>
                                  )}
                              </small>
                            </>
                          ) : (
                            <small>未接收</small>
                          )}
                        </td>
                        <td>
                          <span>{lastEvent?.operator ?? "—"}</span>
                          <small>{formatDT(lastEvent?.at)}</small>
                        </td>
                        <td>
                          <Badge tone={PHASE_META[phase].tone}>
                            {PHASE_META[phase].label}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(s.id);
                            }}
                          >
                            详情
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        没有符合筛选条件的样本
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------- 模态框 */}
      {modal === "new" && (
        <NewSampleForm
          samples={samples}
          defaultOperator={operator}
          onSubmit={handleNew}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "collect" && canCollect(selected) && (
        <CollectForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleCollect}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "receive" && canReceive(selected) && (
        <ReceiveForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleReceive}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "identify" && canIdentify(selected) && (
        <IdentifyForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleIdentify}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "sign" && canSign(selected) && (
        <SignForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleSign}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "return" && canReturn(selected) && (
        <ReturnForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleReturn}
          onCancel={() => setModal(null)}
        />
      )}
      {selected && modal === "review" && canReview(selected) && (
        <ReviewForm
          sample={selected}
          defaultOperator={operator}
          onSubmit={handleReview}
          onCancel={() => setModal(null)}
        />
      )}
    </main>
  );
}

function StageCell({ sample }: { sample: Sample }) {
  const stage = currentStage(sample);
  const names = ["采集", "接收", "鉴定", "签发"];
  if (findActive(sample, "sign")) {
    return (
      <>
        <span>签发完成</span>
        <small>保管链闭环</small>
      </>
    );
  }
  // stage = 已到达的最远环节；其前序均已完成
  const done = names.slice(0, stage);
  const nextName = names[stage + 1] ?? names[stage];
  return (
    <>
      <span>
        {done.length > 0 ? `${done.join(" ✓ ")} ✓` : "（未开始）"}
        {" → "}
        <b>{names[stage]}</b>
      </span>
      <small>
        当前在{names[stage]}段
        {stage < 3 ? `，待办理：${nextName}` : ""}
      </small>
    </>
  );
}

export default App;
