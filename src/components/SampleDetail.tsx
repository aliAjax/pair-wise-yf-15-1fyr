import { useState } from "react";
import {
  STAGE_LABEL,
  STAGE_ORDER,
  STATUS_META,
  getStatus,
  hasOpenHold,
  isSigned,
  registerStage,
  returnStage,
  reviewHold,
  signConclusion,
  stageIndex,
} from "../chain";
import type { ChainEvent, Sample, StageId, StageLog } from "../types";
import StageAction from "./StageAction";

interface Props {
  sample: Sample;
  onClose: () => void;
  onMutate: (next: Sample, error?: string) => void;
}

const EVENT_TEXT: Record<ChainEvent["kind"], string> = {
  collect: "采集登记",
  advance: "交接登记",
  return: "退回",
  hold: "锁定待复核",
  release: "复核通过放开",
  sign: "鉴定结论签发",
};

const EVENT_TONE: Record<ChainEvent["kind"], string> = {
  collect: "tone-neutral",
  advance: "tone-progress",
  return: "tone-warn",
  hold: "tone-danger",
  release: "tone-ok",
  sign: "tone-ok",
};

export default function SampleDetail({ sample, onClose, onMutate }: Props) {
  const [reviewer, setReviewer] = useState("");
  const [signer, setSigner] = useState("");
  const [error, setError] = useState<string | null>(null);

  const status = getStatus(sample);
  const signed = isSigned(sample);
  const openHold = sample.holds.find((h) => h.status === "pending");
  const canSign =
    sample.currentStage === "identification" &&
    !hasOpenHold(sample) &&
    Boolean(sample.logs.identification) &&
    !signed;

  const doReview = (holdId: string, passed: boolean) => {
    if (!reviewer.trim()) return setError("请填写复核人");
    try {
      onMutate(reviewHold(sample, holdId, reviewer, passed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const doSign = () => {
    if (!signer.trim()) return setError("请填写签发人");
    try {
      onMutate(signConclusion(sample, signer.trim()));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const register = (stage: StageId, log: StageLog) => {
    try {
      onMutate(registerStage(sample, stage, log));
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const doReturn = (fromStage: StageId, handler: string, reason: string) => {
    try {
      onMutate(returnStage(sample, fromStage, handler, reason));
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  // 步骤条状态
  const curIdx = stageIndex(sample.currentStage);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p>保管链台账详情</p>
            <h2>{sample.caseId}</h2>
            <span className={`badge ${STATUS_META[status].tone}`}>{STATUS_META[status].label}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <section className="detail-block">
            <h3>样本信息</h3>
            <dl className="info-grid">
              <div><dt>昆虫种类</dt><dd>{sample.species}</dd></div>
              <div><dt>发育阶段</dt><dd>{sample.growthStage}</dd></div>
              <div><dt>采样地点</dt><dd>{sample.location}</dd></div>
              <div><dt>采样时间</dt><dd>{fmt(sample.sampledAt)}</dd></div>
              <div><dt>原始记录温度</dt><dd>{sample.originalTemp}℃</dd></div>
              <div><dt>原始保存方式</dt><dd>{sample.originalPreservation}</dd></div>
              <div className="wide"><dt>备注</dt><dd>{sample.note || "—"}</dd></div>
            </dl>
          </section>

          <section className="detail-block">
            <h3>交接段进度</h3>
            <ol className="stepper">
              {STAGE_ORDER.map((st, i) => {
                const log = sample.logs[st];
                const state =
                  signed || i < curIdx
                    ? "done"
                    : openHold && i === curIdx
                      ? "hold"
                      : i === curIdx
                        ? "current"
                        : "todo";
                return (
                  <li key={st} className={`step ${state}`}>
                    <div className="step-dot">{state === "done" ? "✓" : state === "hold" ? "!" : i + 1}</div>
                    <div className="step-body">
                      <b>{STAGE_LABEL[st]}</b>
                      {log ? (
                        <span>
                          {log.handler} · {fmt(log.time)}
                          {typeof log.temperature === "number" && <> · {log.temperature}℃</>}
                          {log.preservation && <> · {log.preservation}</>}
                        </span>
                      ) : (
                        <span className="muted">未登记</span>
                      )}
                      {st === "identification" && log?.conclusion && (
                        <span className="conclusion">结论：{log.conclusion}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* 失效与复核 */}
          {sample.holds.length > 0 && (
            <section className="detail-block">
              <h3>失效记录与复核</h3>
              <div className="hold-list">
                {sample.holds.map((h) => (
                  <article key={h.id} className={`hold-card ${h.status === "pending" ? "pending" : "passed"}`}>
                    <div className="hold-head">
                      <b>{STAGE_LABEL[h.stage]}段失效</b>
                      <span className={`badge ${h.status === "pending" ? "danger" : "ok"}`}>
                        {h.status === "pending" ? "待复核（锁定中）" : "复核通过"}
                      </span>
                    </div>
                    <ul className="hold-reasons">
                      {h.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <p className="hold-meta">
                      发现于 {fmt(h.raisedAt)}
                      {h.reviewer && <> · 复核人 {h.reviewer} · {fmt(h.reviewedAt ?? "")}</>}
                    </p>
                    {h.status === "pending" && (
                      <div className="review-row">
                        <input
                          placeholder="复核人姓名"
                          value={reviewer}
                          onChange={(e) => setReviewer(e.target.value)}
                        />
                        <button onClick={() => doReview(h.id, false)}>复核不通过</button>
                        <button className="primary" onClick={() => doReview(h.id, true)}>
                          复核通过，放开样本
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 办理区 */}
          {!signed && (
            <section className="detail-block">
              {openHold ? (
                <div className="locked-note">
                  <h3>🔒 样本锁定在待复核</h3>
                  <p>温度超过 8℃ 或保存方式与原始记录不符，复核通过前所有交接与鉴定结论签发均被禁止。</p>
                </div>
              ) : (
                <StageAction
                  key={sample.id + sample.currentStage}
                  sample={sample}
                  onRegister={register}
                  onReturn={doReturn}
                />
              )}
            </section>
          )}

          {/* 签发 */}
          {sample.currentStage === "identification" && (
            <section className="detail-block">
              <h3>鉴定结论签发</h3>
              {signed ? (
                <p className="signed-note">✓ 鉴定结论已签发，保管链完结。</p>
              ) : hasOpenHold(sample) ? (
                <p className="form-error">存在未复核失效记录，鉴定结论不能签发。</p>
              ) : !sample.logs.identification ? (
                <p className="muted">请先完成鉴定登记。</p>
              ) : (
                <div className="review-row">
                  <input placeholder="签发人姓名" value={signer} onChange={(e) => setSigner(e.target.value)} />
                  <button className="primary" onClick={doSign}>
                    签发鉴定结论
                  </button>
                </div>
              )}
            </section>
          )}

          {error && <p className="form-error">{error}</p>}

          {/* 交接时间线 */}
          <section className="detail-block">
            <h3>交接记录与失效原因</h3>
            <ol className="timeline">
              {sample.events.map((e) => (
                <li key={e.id} className="timeline-item">
                  <span className={`evt-tag ${EVENT_TONE[e.kind]}`}>{EVENT_TEXT[e.kind]}</span>
                  <div>
                    <p className="evt-line">
                      <b>{e.handler}</b>
                      <span className="muted"> · {STAGE_LABEL[e.stage]}段 · {fmt(e.time)}</span>
                    </p>
                    {e.detail && <p className="evt-detail">{e.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function fmt(value: string): string {
  if (!value) return "";
  return value.replace("T", " ");
}
