import { useState } from "react";
import {
  GROWTH_STAGES,
  PRESERVATION_OPTIONS,
  nextSampleNumber,
  nowLocal,
  type NewSampleInput,
} from "../chain";
import type { GrowthStage, Sample } from "../types";

interface Props {
  samples: Sample[];
  onClose: () => void;
  onCreate: (input: NewSampleInput) => string | null; // 返回错误信息
}

const blank = (samples: Sample[]) => ({
  caseId: `CASE-${String(nextSampleNumber(samples)).padStart(3, "0")}-A`,
  species: "",
  growthStage: "幼虫" as GrowthStage,
  location: "",
  sampledAt: nowLocal(),
  note: "",
  originalTemp: "",
  originalPreservation: PRESERVATION_OPTIONS[0],
  collector: "",
  collectTime: nowLocal(),
});

export default function NewSampleModal({ samples, onClose, onCreate }: Props) {
  const [form, setForm] = useState(blank(samples));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const temp = Number(form.originalTemp);
    if (!form.caseId.trim()) return setError("请填写案件编号");
    if (!form.species.trim()) return setError("请填写昆虫种类");
    if (!form.location.trim()) return setError("请填写采样地点");
    if (!form.sampledAt) return setError("请填写采样时间");
    if (!Number.isFinite(temp)) return setError("请填写原始记录温度（数值）");
    if (!form.collector.trim()) return setError("请填写采集经办人");
    if (!form.collectTime) return setError("请填写采集登记时间");

    const err = onCreate({
      ...form,
      caseId: form.caseId,
      species: form.species,
      location: form.location,
      note: form.note,
      originalTemp: temp,
      collector: form.collector,
    });
    if (err) setError(err);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p>保管链建档</p>
            <h2>新增昆虫学样本 · 采集登记</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="field-grid">
          <label>
            <span>案件编号</span>
            <input value={form.caseId} onChange={(e) => set("caseId", e.target.value)} placeholder="CASE-056-A" />
          </label>
          <label>
            <span>昆虫种类</span>
            <input value={form.species} onChange={(e) => set("species", e.target.value)} placeholder="如 丝光绿蝇" />
          </label>
          <label>
            <span>发育阶段</span>
            <select value={form.growthStage} onChange={(e) => set("growthStage", e.target.value as GrowthStage)}>
              {GROWTH_STAGES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>采样地点</span>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </label>
          <label>
            <span>采样时间</span>
            <input type="datetime-local" value={form.sampledAt} onChange={(e) => set("sampledAt", e.target.value)} />
          </label>
          <label>
            <span>原始记录温度（℃）</span>
            <input
              type="number"
              step="0.1"
              value={form.originalTemp}
              onChange={(e) => set("originalTemp", e.target.value)}
            />
          </label>
          <label>
            <span>原始保存方式</span>
            <select
              value={form.originalPreservation}
              onChange={(e) => set("originalPreservation", e.target.value)}
            >
              {PRESERVATION_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>采集经办人</span>
            <input value={form.collector} onChange={(e) => set("collector", e.target.value)} placeholder="姓名（岗位）" />
          </label>
          <label>
            <span>采集登记时间</span>
            <input
              type="datetime-local"
              value={form.collectTime}
              onChange={(e) => set("collectTime", e.target.value)}
            />
          </label>
          <label className="wide">
            <span>鉴定/采样备注</span>
            <textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={submit}>
            完成采集登记建档
          </button>
        </div>
      </div>
    </div>
  );
}
