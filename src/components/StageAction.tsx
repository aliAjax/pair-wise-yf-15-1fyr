import { useMemo, useState } from "react";
import {
  PRESERVATION_OPTIONS,
  STAGE_LABEL,
  TEMP_LIMIT,
  findViolations,
  nowLocal,
} from "../chain";
import type { Sample, StageId, StageLog } from "../types";

interface Props {
  sample: Sample;
  onRegister: (stage: StageId, log: StageLog) => string | null;
  onReturn: (fromStage: StageId, handler: string, reason: string) => string | null;
}

export default function StageAction({ sample, onRegister, onReturn }: Props) {
  const stage = sample.currentStage;
  const [handler, setHandler] = useState("");
  const [time, setTime] = useState(nowLocal());
  const [temperature, setTemperature] = useState("");
  const [preservation, setPreservation] = useState(sample.originalPreservation);
  const [conclusion, setConclusion] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 退回表单
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnHandler, setReturnHandler] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const tempNum = temperature === "" ? undefined : Number(temperature);
  const violations = useMemo(
    () =>
      stage === "receipt" || stage === "identification"
        ? findViolations(sample, tempNum, preservation)
        : [],
    [sample, stage, tempNum, preservation],
  );

  const submit = () => {
    if (!handler.trim()) return setError("请填写本段经办人");
    if (!time) return setError("请填写登记时间");

    const log: StageLog = { handler: handler.trim(), time };
    if (stage === "receipt" || stage === "identification") {
      if (tempNum === undefined || !Number.isFinite(tempNum)) return setError("请填写实测样本温度");
      log.temperature = tempNum;
      log.preservation = preservation;
    }
    if (stage === "identification") {
      if (!conclusion.trim()) return setError("请填写鉴定结论（提交后仍需复核通过方可签发）");
      log.conclusion = conclusion.trim();
    }
    setError(onRegister(stage, log));
  };

  const submitReturn = () => {
    if (!returnHandler.trim()) return setError("请填写退回经办人");
    if (!returnReason.trim()) return setError("退回必须填写原因");
    setError(onReturn(stage, returnHandler.trim(), returnReason.trim()));
  };

  return (
    <div className="action-box">
      <div className="action-head">
        <h3>办理「{STAGE_LABEL[stage]}」段</h3>
        <button className="ghost danger-text" onClick={() => setReturnOpen((v) => !v)}>
          {returnOpen ? "收起退回" : "退回上一段"}
        </button>
      </div>

      {returnOpen ? (
        <div className="return-box">
          <p className="hint">
            退回后样本回到上一段，本段登记记录将被清除、需重新办理；历史交接记录保留。
          </p>
          <label>
            <span>退回经办人</span>
            <input value={returnHandler} onChange={(e) => setReturnHandler(e.target.value)} />
          </label>
          <label>
            <span>退回原因（必填）</span>
            <textarea
              rows={2}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="如：样本标签缺失/包装破损/温度链断裂……"
            />
          </label>
          <button className="danger" onClick={submitReturn}>
            确认退回「{STAGE_LABEL[stage]}」段
          </button>
        </div>
      ) : (
        <>
          <div className="field-grid two">
            <label>
              <span>经办人</span>
              <input value={handler} onChange={(e) => setHandler(e.target.value)} placeholder="姓名（岗位）" />
            </label>
            <label>
              <span>登记时间</span>
              <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>

            {(stage === "receipt" || stage === "identification") && (
              <>
                <label>
                  <span>实测样本温度（℃，超过 {TEMP_LIMIT}℃ 失效）</span>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                </label>
                <label>
                  <span>实际保存方式（须与原始记录一致）</span>
                  <select value={preservation} onChange={(e) => setPreservation(e.target.value)}>
                    {PRESERVATION_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {stage === "identification" && (
              <label className="wide">
                <span>鉴定结论</span>
                <textarea
                  rows={2}
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  placeholder="种类、发育阶段与最短发育时间等"
                />
              </label>
            )}
          </div>

          {violations.length > 0 && (
            <div className="violation-warn">
              <b>⚠ 提交后将锁入待复核，鉴定结论不能签发：</b>
              <ul>
                {violations.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <button className="primary" onClick={submit}>
            {stage === "collection"
              ? "提交采集登记"
              : stage === "receipt"
                ? "完成接收登记"
                : "提交鉴定登记"}
          </button>
        </>
      )}
    </div>
  );
}
