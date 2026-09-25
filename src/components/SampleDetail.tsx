import type { ChainEvent, Sample } from "../types";
import {
  canCollect,
  canIdentify,
  canReceive,
  canReturn,
  canReview,
  canSign,
  currentStage,
  failureReasons,
  findActive,
  formatDT,
  isLocked,
  lastReviewPass,
  PHASE_META,
  phaseKey,
  STAGES,
  TEMP_LIMIT,
} from "../model";
import { Badge, Button } from "./ui";

export type ActionKey =
  | "collect"
  | "receive"
  | "identify"
  | "sign"
  | "return"
  | "review";

interface DetailProps {
  sample: Sample;
  onAction: (key: ActionKey) => void;
  onClose: () => void;
}

const EVENT_LABEL: Record<ChainEvent["type"], string> = {
  collect: "采集登记",
  receive: "接收登记",
  identify: "鉴定登记",
  sign: "结论签发",
  return: "退回",
  review: "复核",
};

function Stepper({ sample }: { sample: Sample }) {
  const stage = currentStage(sample);
  const signed = !!findActive(sample, "sign");
  const locked = isLocked(sample);

  return (
    <ol className="stepper">
      {STAGES.map((s) => {
        let state: "done" | "current" | "todo" = "todo";
        if (signed) state = "done";
        else if (s.index < stage) state = "done";
        else if (s.index === stage) state = "current";
        // 已采集（stage=0 且有采集记录）但等待接收时，采集段显示完成
        if (
          s.index === 0 &&
          stage === 0 &&
          findActive(sample, "collect")
        ) {
          state = "done";
        }
        return (
          <li key={s.index} className={`step ${state}`}>
            <span className="step-dot">{s.index + 1}</span>
            <span className="step-name">{s.name}</span>
            {locked && s.index >= 1 && state !== "done" && (
              <span className="step-lock">锁</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="info-row">
      <span>{k}</span>
      <b>{v || "—"}</b>
    </div>
  );
}

function TimelineEvent({ ev }: { ev: ChainEvent }) {
  const tone = ev.superseded ? "void" : ev.type;
  return (
    <li className={`tl-item tl-${tone}`}>
      <div className="tl-head">
        <span className="tl-type">{EVENT_LABEL[ev.type]}</span>
        <span className="tl-time">{formatDT(ev.at)}</span>
        {ev.superseded && <Badge tone="gray">已作废</Badge>}
        {ev.type === "return" && !ev.superseded && (
          <Badge tone="amber">退回留痕</Badge>
        )}
        {ev.type === "review" && !ev.superseded && (
          <Badge tone={ev.pass ? "green" : "red"}>
            复核{ev.pass ? "通过" : "未通过"}
          </Badge>
        )}
      </div>
      <div className="tl-operator">经办人：{ev.operator || "（未填）"}</div>

      {ev.type === "collect" && (
        <dl className="tl-grid">
          <div><dt>采样地点</dt><dd>{ev.location}</dd></div>
          <div><dt>采样时间</dt><dd>{formatDT(ev.collectedAt)}</dd></div>
          <div><dt>现场环境温度</dt><dd>{ev.envTemp}℃</dd></div>
          <div><dt>尸体暴露阶段</dt><dd>{ev.exposure}</dd></div>
          <div><dt>原始保存方式</dt><dd>{ev.preservation}</dd></div>
        </dl>
      )}

      {ev.type === "receive" && (
        <dl className="tl-grid">
          <div>
            <dt>接收温度</dt>
            <dd>
              {ev.temp}℃
              {ev.temp > TEMP_LIMIT && (
                <Badge tone="red">超 {TEMP_LIMIT}℃</Badge>
              )}
            </dd>
          </div>
          <div><dt>保存方式</dt><dd>{ev.preservation}</dd></div>
          {ev.lab && <div><dt>接收岗位</dt><dd>{ev.lab}</dd></div>}
        </dl>
      )}

      {ev.type === "identify" && (
        <dl className="tl-grid">
          <div><dt>鉴定方法</dt><dd>{ev.method}</dd></div>
          <div><dt>置信度</dt><dd>{ev.confidence || "—"}</dd></div>
          <div className="tl-wide"><dt>鉴定意见（拟稿）</dt><dd>{ev.conclusion}</dd></div>
        </dl>
      )}

      {ev.type === "sign" && (
        <dl className="tl-grid">
          <div className="tl-wide">
            <dt>签发结论</dt>
            <dd className="signed-text">{ev.conclusionText}</dd>
          </div>
        </dl>
      )}

      {ev.type === "return" && (
        <div className="tl-return">
          <div>
            自 <b>{STAGES[ev.fromStage].name}</b> 退回至{" "}
            <b>{STAGES[ev.fromStage - 1].name}</b>
          </div>
          <p><b>退回原因：</b>{ev.reason}</p>
          {ev.supersededIds.length > 0 && (
            <small>本次作废登记 {ev.supersededIds.length} 条（仍保留于链中）</small>
          )}
        </div>
      )}

      {ev.type === "review" && (
        <div className={`tl-review ${ev.pass ? "pass" : "fail"}`}>
          {ev.reasons.length > 0 ? (
            <ul>
              {ev.reasons.map((r) => (
                <li key={r}>失效原因：{r}</li>
              ))}
            </ul>
          ) : (
            <p>登记时无失效原因</p>
          )}
        </div>
      )}

      {ev.note && <p className="tl-note">备注：{ev.note}</p>}
    </li>
  );
}

export function SampleDetail({ sample, onAction, onClose }: DetailProps) {
  const phase = phaseKey(sample);
  const meta = PHASE_META[phase];
  const locked = isLocked(sample);
  const reasons = failureReasons(sample);
  const reviewPass = lastReviewPass(sample);
  const collect = findActive(sample, "collect");
  const receive = findActive(sample, "receive");
  const identify = findActive(sample, "identify");
  const sign = findActive(sample, "sign");

  const preservationMismatch =
    collect && receive && collect.preservation !== receive.preservation;

  const actions: { key: ActionKey; label: string; variant: "primary" | "danger" | "default"; enabled: boolean; hint?: string }[] = [
    {
      key: "collect",
      label: collect ? "重办采集登记" : "办理采集登记",
      variant: "primary",
      enabled: canCollect(sample),
      hint: canCollect(sample)
        ? undefined
        : "采集段已完成（如信息有误请由接收段退回）",
    },
    {
      key: "receive",
      label: "办理接收登记",
      variant: "primary",
      enabled: canReceive(sample),
      hint: canReceive(sample)
        ? undefined
        : !collect
          ? "需先完成采集登记"
          : "接收段已完成（如信息有误请由鉴定段退回）",
    },
    {
      key: "identify",
      label: identify ? "更新鉴定拟稿" : "办理鉴定登记",
      variant: "primary",
      enabled: canIdentify(sample),
      hint: canIdentify(sample)
        ? undefined
        : !receive
          ? "需先完成接收登记"
          : findActive(sample, "sign")
            ? "已签发，不可更改"
            : undefined,
    },
    {
      key: "sign",
      label: "签发鉴定结论",
      variant: "primary",
      enabled: canSign(sample),
      hint: !isIdentifiedReady(sample)
        ? "需先完成鉴定登记"
        : locked
          ? "样本锁在待复核，复核通过后才可签发"
          : undefined,
    },
    {
      key: "return",
      label: "退回上一段",
      variant: "danger",
      enabled: canReturn(sample),
      hint: canReturn(sample) ? undefined : "已签发样本不可退回",
    },
    {
      key: "review",
      label: "办理复核",
      variant: "default",
      enabled: canReview(sample),
      hint: canReview(sample) ? undefined : "无有效异常，无需复核",
    },
  ];

  return (
    <div className="detail">
      <div className="detail-top">
        <div>
          <div className="detail-title-row">
            <h2>{sample.id}</h2>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {locked && <Badge tone="red">禁止签发</Badge>}
            {sign && <Badge tone="green">结论已签发</Badge>}
          </div>
          <p className="detail-sub">
            {sample.species} · {sample.stage} · 案件 {sample.caseNo}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          返回列表
        </Button>
      </div>

      <Stepper sample={sample} />

      {locked && (
        <div className="lock-banner">
          <div className="lock-banner-title">
            <span className="lock-ico">⛔</span>
            样本锁在待复核，鉴定结论不能签发
          </div>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {reviewPass === false && (
            <p className="lock-review-note">上次复核未通过，请整改后重新复核。</p>
          )}
          {reviewPass === undefined && (
            <p className="lock-review-note">尚未复核，请由复核人办理复核。</p>
          )}
        </div>
      )}
      {!locked && receive && (receive.temp > TEMP_LIMIT || preservationMismatch) && (
        <div className="lock-banner resolved">
          <div className="lock-banner-title">✓ 复核已通过，锁定已放开</div>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}（已由复核确认放行）</li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel detail-panel">
        <h3>样本与原始记录</h3>
        <div className="info-grid">
          <InfoRow k="样本编号" v={sample.id} />
          <InfoRow k="案件编号" v={sample.caseNo} />
          <InfoRow k="昆虫种类" v={sample.species} />
          <InfoRow k="发育阶段" v={sample.stage} />
          <InfoRow
            k="采样地点"
            v={collect?.location ?? "（采集段未登记）"}
          />
          <InfoRow
            k="采样时间"
            v={collect ? formatDT(collect.collectedAt) : "—"}
          />
          <InfoRow
            k="现场环境温度"
            v={collect ? `${collect.envTemp}℃` : "—"}
          />
          <InfoRow
            k="尸体暴露阶段"
            v={collect?.exposure ?? "—"}
          />
          <InfoRow
            k="原始保存方式"
            v={collect?.preservation ?? "—"}
          />
          <InfoRow
            k="接收温度"
            v={receive ? `${receive.temp}℃${receive.temp > TEMP_LIMIT ? "（超限）" : ""}` : "—"}
          />
          <InfoRow
            k="接收保存方式"
            v={receive?.preservation ?? "—"}
          />
          <InfoRow
            k="台账创建时间"
            v={formatDT(sample.createdAt)}
          />
        </div>
      </section>

      <section className="panel detail-panel">
        <h3>
          保管链交接记录
          <small>共 {sample.events.length} 条，作废记录保留留痕</small>
        </h3>
        <ol className="timeline">
          {sample.events.map((ev) => (
            <TimelineEvent key={ev.id} ev={ev} />
          ))}
        </ol>
      </section>

      <section className="panel detail-panel">
        <h3>办理操作</h3>
        <p className="actions-hint">
          保管链按 采集 → 接收 → 鉴定 → 签发 顺序办理；前一段未完成，后一段不可办理。
        </p>
        <div className="action-grid">
          {actions.map((a) => (
            <div key={a.key} className="action-cell">
              <Button
                variant={a.variant}
                disabled={!a.enabled}
                onClick={() => onAction(a.key)}
              >
                {a.label}
              </Button>
              {a.hint && <small>{a.hint}</small>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function isIdentifiedReady(sample: Sample): boolean {
  return !!findActive(sample, "identify");
}
