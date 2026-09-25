import { useEffect, useMemo, useReducer, useState } from "react";
import "./styles.css";
import {
  GROWTH_STAGES,
  STAGE_LABEL,
  STATUS_META,
  TEMP_LIMIT,
  createSample,
  getStatus,
  isSigned,
  type NewSampleInput,
} from "./chain";
import type { GrowthStage, Sample } from "./types";
import { buildSeedSamples, clearStorage, loadSamples, saveSamples } from "./storage";
import NewSampleModal from "./components/NewSampleModal";
import SampleDetail from "./components/SampleDetail";

type Action =
  | { type: "create"; input: NewSampleInput }
  | { type: "replace"; sample: Sample }
  | { type: "reset" };

interface State {
  samples: Sample[];
  error: string | null;
}

function initState(): State {
  const stored = loadSamples();
  return { samples: stored ?? buildSeedSamples(), error: null };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "create":
      try {
        const sample = createSample(action.input);
        return { samples: [sample, ...state.samples], error: null };
      } catch (e) {
        return { ...state, error: (e as Error).message };
      }
    case "replace": {
      const samples = state.samples.map((s) => (s.id === action.sample.id ? action.sample : s));
      return { samples, error: null };
    }
    case "reset":
      clearStorage();
      return { samples: buildSeedSamples(), error: null };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const { samples } = state;

  // 重开页面仍保留记录
  useEffect(() => {
    saveSamples(samples);
  }, [samples]);

  const [caseFilter, setCaseFilter] = useState("all");
  const [growthFilter, setGrowthFilter] = useState<GrowthStage | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const caseIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseId.split("-").slice(0, 2).join("-")))).sort(),
    [samples],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return samples.filter((s) => {
      if (caseFilter !== "all" && !s.caseId.startsWith(caseFilter + "-")) return false;
      if (growthFilter !== "all" && s.growthStage !== growthFilter) return false;
      if (kw && !`${s.caseId} ${s.species} ${s.location} ${s.note}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [samples, caseFilter, growthFilter, keyword]);

  const detail = openId ? samples.find((s) => s.id === openId) ?? null : null;

  const counts = {
    total: samples.length,
    holding: samples.filter((s) => getStatus(s) === "holding").length,
    waiting: samples.filter((s) => {
      const st = getStatus(s);
      return st === "atCollection" || st === "atReceipt" || st === "atIdentification";
    }).length,
    signed: samples.filter((s) => isSigned(s)).length,
    returned: samples.filter((s) =>
      s.events.some((e) => e.kind === "return" && !isSigned(s)),
    ).length,
  };

  return (
    <main className="app">
      <section className="hero">
        <p>法医物证 · 保管链台账（Chain of Custody）</p>
        <h1>法医昆虫学样本保管链</h1>
        <span>
          样本按「采集 → 接收 → 鉴定登记」逐段登记经办人与时间，前一段未完成后一段不能办理；
          退回须填写原因并回到上一段。实测温度超过 {TEMP_LIMIT}℃ 或保存方式与原始记录不符时，
          样本锁入待复核、鉴定结论不能签发，复核通过后放开。记录保存在本机，重开页面不丢失。
        </span>
      </section>

      <section className="metrics">
        <article><small>样本总数</small><strong>{counts.total}</strong></article>
        <article><small>流程中</small><strong>{counts.waiting}</strong></article>
        <article className="metric-danger"><small>待复核锁定</small><strong>{counts.holding}</strong></article>
        <article><small>已退回待重办</small><strong>{counts.returned}</strong></article>
        <article className="metric-ok"><small>鉴定结论已签发</small><strong>{counts.signed}</strong></article>
      </section>

      <section className="toolbar panel">
        <div className="filter-group">
          <span className="filter-label">案件</span>
          <div className="chips">
            <button
              className={caseFilter === "all" ? "chip active" : "chip"}
              onClick={() => setCaseFilter("all")}
            >
              全部
            </button>
            {caseIds.map((c) => (
              <button
                key={c}
                className={caseFilter === c ? "chip active" : "chip"}
                onClick={() => setCaseFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">发育阶段</span>
          <div className="chips">
            <button
              className={growthFilter === "all" ? "chip active" : "chip"}
              onClick={() => setGrowthFilter("all")}
            >
              全部
            </button>
            {GROWTH_STAGES.map((g) => (
              <button
                key={g}
                className={growthFilter === g ? "chip active" : "chip"}
                onClick={() => setGrowthFilter(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <input
            className="search"
            placeholder="搜索编号 / 种类 / 地点 / 备注"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button className="primary" onClick={() => setShowNew(true)}>
            + 新增样本建档
          </button>
          <button
            className="ghost"
            title="清空本机记录并恢复演示数据"
            onClick={() => {
              if (window.confirm("确认清空本机台账记录并恢复演示数据？")) dispatch({ type: "reset" });
            }}
          >
            重置演示
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>样本批次</p>
            <h2>保管链列表（{filtered.length}）</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="sample-table">
            <thead>
              <tr>
                <th>案件 / 样本</th>
                <th>种类</th>
                <th>发育阶段</th>
                <th>采样地点</th>
                <th>当前所在段</th>
                <th>最近经办人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const st = getStatus(s);
                const lastLog = s.logs[s.currentStage];
                const lastHandler =
                  lastLog?.handler ?? s.events[s.events.length - 1]?.handler ?? "—";
                return (
                  <tr key={s.id} onClick={() => setOpenId(s.id)} className="row-click">
                    <td><b>{s.caseId}</b><br /><small>{fmt(s.sampledAt)}</small></td>
                    <td>{s.species}</td>
                    <td><span className="stage-pill">{s.growthStage}</span></td>
                    <td>{s.location}</td>
                    <td>{STAGE_LABEL[s.currentStage]}段</td>
                    <td>{lastHandler}</td>
                    <td><span className={`badge ${STATUS_META[st].tone}`}>{STATUS_META[st].label}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">没有符合筛选条件的样本</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showNew && (
        <NewSampleModal
          samples={samples}
          onClose={() => setShowNew(false)}
          onCreate={(input) => {
            try {
              dispatch({ type: "create", input });
              setShowNew(false);
              return null;
            } catch (e) {
              return (e as Error).message;
            }
          }}
        />
      )}

      {detail && (
        <SampleDetail
          sample={detail}
          onClose={() => setOpenId(null)}
          onMutate={(next) => dispatch({ type: "replace", sample: next })}
        />
      )}
    </main>
  );
}

function fmt(value: string): string {
  return value ? value.replace("T", " ") : "";
}

export default App;
