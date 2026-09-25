import { useMemo, useState } from "react";
import type { Sample } from "../types";
import {
  CONFIDENCE,
  DEVELOPMENT_STAGES,
  EXPOSURE_STAGES,
  failureReasons,
  findActive,
  formatDT,
  METHODS,
  nowLocal,
  PRESERVATIONS,
  STAGES,
  suggestSampleId,
  TEMP_LIMIT,
} from "../model";
import {
  Button,
  ErrorNote,
  Modal,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "./ui";

/* ------------------------------------------------------- 共用经办人字段 */

interface BaseVal {
  at: string;
  operator: string;
  note: string;
}

function BaseFields({
  value,
  onChange,
  operatorLabel = "经办人",
  timeLabel = "经办时间",
}: {
  value: BaseVal;
  onChange: (v: BaseVal) => void;
  operatorLabel?: string;
  timeLabel?: string;
}) {
  return (
    <>
      <TextField
        label={operatorLabel}
        required
        placeholder="姓名 / 岗位，如 物证管理员 李颖"
        value={value.operator}
        invalid={value.operator.trim() === ""}
        onChange={(e) => onChange({ ...value, operator: e.target.value })}
      />
      <TextField
        label={timeLabel}
        required
        type="datetime-local"
        step={1}
        value={value.at}
        invalid={value.at === ""}
        onChange={(e) => onChange({ ...value, at: e.target.value })}
      />
      <TextAreaField
        label="备注"
        rows={2}
        placeholder="选填"
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
    </>
  );
}

function useBase(defaultOperator: string): [BaseVal, (v: BaseVal) => void] {
  const [base, setBase] = useState<BaseVal>({
    at: nowLocal(),
    operator: defaultOperator,
    note: "",
  });
  return [base, setBase];
}

function ModalCard({
  title,
  subtitle,
  onClose,
  children,
  onSubmit,
  submitLabel,
  submitDisabled,
  width,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  width?: number;
}) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      width={width}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="form-grid">{children}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------- 采集登记 */

export interface CollectPayload extends BaseVal {
  location: string;
  envTemp: number;
  exposure: string;
  collectedAt: string;
  preservation: string;
}

export function CollectForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: CollectPayload) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useBase(defaultOperator);
  const [f, setF] = useState({
    location: "",
    envTemp: "" as string | number,
    exposure: EXPOSURE_STAGES[1],
    collectedAt: nowLocal(),
    preservation: PRESERVATIONS[0],
  });
  const [err, setErr] = useState("");

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "") {
      setErr("请填写经办人和经办时间");
      return;
    }
    if (!f.location.trim()) return setErr("请填写采样地点");
    if (f.envTemp === "" || Number.isNaN(Number(f.envTemp)))
      return setErr("请填写现场环境温度");
    if (!f.collectedAt) return setErr("请填写采样时间");
    onSubmit({
      ...base,
      location: f.location.trim(),
      envTemp: Number(f.envTemp),
      exposure: f.exposure,
      collectedAt: f.collectedAt,
      preservation: f.preservation,
    });
  };

  return (
    <ModalCard
      title={`采集登记 · ${sample.id}`}
      subtitle={<p className="modal-sub">第一段：现场采集原始记录</p>}
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="提交采集登记"
    >
      <ErrorNote>{err}</ErrorNote>
      <TextField
        label="采样地点"
        required
        placeholder="如 城郊废弃草地 · 尸体口鼻腔"
        value={f.location}
        invalid={f.location === ""}
        onChange={(e) => setF({ ...f, location: e.target.value })}
      />
      <NumberField
        label="现场环境温度（℃）"
        required
        step={0.1}
        value={f.envTemp}
        invalid={f.envTemp === ""}
        onChange={(e) => setF({ ...f, envTemp: e.target.value })}
      />
      <SelectField
        label="尸体暴露阶段"
        required
        options={EXPOSURE_STAGES}
        value={f.exposure}
        onChange={(e) => setF({ ...f, exposure: e.target.value })}
      />
      <TextField
        label="采样时间"
        required
        type="datetime-local"
        step={1}
        value={f.collectedAt}
        onChange={(e) => setF({ ...f, collectedAt: e.target.value })}
      />
      <SelectField
        label="原始保存方式"
        required
        options={PRESERVATIONS}
        value={f.preservation}
        onChange={(e) => setF({ ...f, preservation: e.target.value })}
      />
      <BaseFields value={base} onChange={setBase} />
    </ModalCard>
  );
}

/* ------------------------------------------------------------- 接收登记 */

export interface ReceivePayload extends BaseVal {
  temp: number;
  preservation: string;
  lab: string;
}

export function ReceiveForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: ReceivePayload) => void;
  onCancel: () => void;
}) {
  const collect = findActive(sample, "collect");
  const [base, setBase] = useBase(defaultOperator);
  const [f, setF] = useState({
    temp: "",
    preservation: collect?.preservation ?? PRESERVATIONS[0],
    lab: "法医昆虫学实验室",
  });
  const [err, setErr] = useState("");

  const tempNum = f.temp === "" ? NaN : Number(f.temp);
  const tempOver = !Number.isNaN(tempNum) && tempNum > TEMP_LIMIT;
  const mismatch =
    !!collect && f.preservation !== collect.preservation;

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (f.temp === "" || Number.isNaN(Number(f.temp)))
      return setErr("请填写接收时冷链温度");
    onSubmit({
      ...base,
      temp: Number(f.temp),
      preservation: f.preservation,
      lab: f.lab.trim(),
    });
  };

  return (
    <ModalCard
      title={`接收登记 · ${sample.id}`}
      subtitle={<p className="modal-sub">第二段：实验室/物证岗接收核对</p>}
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="提交接收登记"
    >
      <ErrorNote>{err}</ErrorNote>
      <NumberField
        label={`接收时冷链温度（℃，上限 ${TEMP_LIMIT}℃）`}
        required
        step={0.1}
        value={f.temp}
        invalid={f.temp === ""}
        hint={
          tempOver
            ? `超过 ${TEMP_LIMIT}℃，提交后样本将锁入待复核`
            : undefined
        }
        onChange={(e) => setF({ ...f, temp: e.target.value })}
      />
      <SelectField
        label="接收时保存方式"
        required
        options={PRESERVATIONS}
        value={f.preservation}
        hint={
          mismatch && collect
            ? `与原始记录「${collect.preservation}」不一致，提交后锁入待复核`
            : "应与原始记录一致"
        }
        onChange={(e) => setF({ ...f, preservation: e.target.value })}
      />
      <TextField
        label="接收岗位 / 存放位置"
        placeholder="如 法医昆虫学实验室 · 冷藏柜2"
        value={f.lab}
        onChange={(e) => setF({ ...f, lab: e.target.value })}
      />
      <div className="form-note">
        原始记录：{collect ? `${collect.preservation} · 采样 ${formatDT(collect.collectedAt)}` : "—"}
        {tempOver && <span className="warn-chip">温度将超限</span>}
        {mismatch && <span className="warn-chip">保存方式不一致</span>}
      </div>
      <BaseFields value={base} onChange={setBase} />
    </ModalCard>
  );
}

/* ------------------------------------------------------------- 鉴定登记 */

export interface IdentifyPayload extends BaseVal {
  method: string;
  conclusion: string;
  confidence: string;
}

export function IdentifyForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: IdentifyPayload) => void;
  onCancel: () => void;
}) {
  const existing = findActive(sample, "identify");
  const [base, setBase] = useBase(defaultOperator);
  const [f, setF] = useState({
    method: existing?.method ?? METHODS[0],
    conclusion: existing?.conclusion ?? "",
    confidence: existing?.confidence ?? CONFIDENCE[0],
  });
  const [err, setErr] = useState("");

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (!f.conclusion.trim()) return setErr("请填写鉴定意见拟稿");
    onSubmit({ ...base, ...f, conclusion: f.conclusion.trim() });
  };

  return (
    <ModalCard
      title={`鉴定登记 · ${sample.id}`}
      subtitle={<p className="modal-sub">第三段：鉴定意见登记（拟稿，签发后生效）</p>}
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="提交鉴定登记"
    >
      <ErrorNote>{err}</ErrorNote>
      <SelectField
        label="鉴定方法"
        required
        options={METHODS}
        value={f.method}
        onChange={(e) => setF({ ...f, method: e.target.value })}
      />
      <SelectField
        label="置信度"
        required
        options={CONFIDENCE}
        value={f.confidence}
        onChange={(e) => setF({ ...f, confidence: e.target.value })}
      />
      <div className="full">
        <TextAreaField
          label="鉴定意见（拟稿）"
          required
          rows={4}
          placeholder="种属、发育阶段、形态/分子依据…"
          value={f.conclusion}
          onChange={(e) => setF({ ...f, conclusion: e.target.value })}
        />
      </div>
      <BaseFields value={base} onChange={setBase} />
    </ModalCard>
  );
}

/* ------------------------------------------------------------- 结论签发 */

export interface SignPayload extends BaseVal {
  conclusionText: string;
}

export function SignForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: SignPayload) => void;
  onCancel: () => void;
}) {
  const identify = findActive(sample, "identify");
  const [base, setBase] = useBase(defaultOperator);
  const [text, setText] = useState(
    identify
      ? `鉴定结论成立：${identify.conclusion}`
      : ""
  );
  const [err, setErr] = useState("");

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (!text.trim()) return setErr("请填写签发结论");
    onSubmit({ ...base, conclusionText: text.trim() });
  };

  return (
    <ModalCard
      title={`签发鉴定结论 · ${sample.id}`}
      subtitle={<p className="modal-sub">第四段：授权签字人签发，保管链闭环</p>}
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="确认签发"
    >
      <ErrorNote>{err}</ErrorNote>
      <div className="form-note full">
        依据鉴定拟稿（{identify?.method}，{identify?.confidence}）：
        {identify?.conclusion}
      </div>
      <div className="full">
        <TextAreaField
          label="签发结论"
          required
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <BaseFields
        value={base}
        onChange={setBase}
        operatorLabel="授权签字人"
      />
    </ModalCard>
  );
}

/* ----------------------------------------------------------------- 退回 */

export interface ReturnPayload extends BaseVal {
  reason: string;
}

export function ReturnForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: ReturnPayload) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useBase(defaultOperator);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const stage = useMemo(() => {
    if (findActive(sample, "sign")) return 3;
    if (findActive(sample, "identify")) return 2;
    if (findActive(sample, "receive")) return 1;
    return 0;
  }, [sample]);
  // 已到达鉴定段（stage 2）则退回接收段；否则（stage 1）退回采集段
  const fromStageIndex = stage >= 2 ? 2 : 1;
  const fromName = STAGES[fromStageIndex].name;
  const toName = STAGES[fromStageIndex - 1].name;

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (!reason.trim()) return setErr("退回必须填写原因");
    onSubmit({ ...base, reason: reason.trim() });
  };

  return (
    <ModalCard
      title={`退回登记 · ${sample.id}`}
      subtitle={
        <p className="modal-sub">
          自 <b>{fromName}</b> 退回至 <b>{toName}</b>，本段及之后登记将作废并保留留痕
        </p>
      }
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="确认退回"
    >
      <ErrorNote>{err}</ErrorNote>
      <div className="full">
        <TextAreaField
          label="退回原因（必填）"
          required
          rows={4}
          placeholder="如：温控记录缺失 / 保存方式被改动 / 鉴定依据不足…"
          value={reason}
          invalid={reason === ""}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <BaseFields value={base} onChange={setBase} />
    </ModalCard>
  );
}

/* ----------------------------------------------------------------- 复核 */

export interface ReviewPayload extends BaseVal {
  pass: boolean;
}

export function ReviewForm({
  sample,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  sample: Sample;
  defaultOperator: string;
  onSubmit: (p: ReviewPayload) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useBase(defaultOperator);
  const [pass, setPass] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const reasons = failureReasons(sample);

  const submit = () => {
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (pass === null) return setErr("请选择复核结论");
    onSubmit({ ...base, pass });
  };

  return (
    <ModalCard
      title={`复核登记 · ${sample.id}`}
      subtitle={<p className="modal-sub">样本因失效原因锁在待复核，复核通过后放开签发</p>}
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="提交复核"
    >
      <ErrorNote>{err}</ErrorNote>
      <div className="full">
        <span className="field-label">当前失效原因</span>
        <ul className="reason-list">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="full review-choice">
        <button
          type="button"
          className={`choice ${pass === true ? "selected pass" : ""}`}
          onClick={() => setPass(true)}
        >
          ✓ 复核通过，放开锁定
        </button>
        <button
          type="button"
          className={`choice ${pass === false ? "selected fail" : ""}`}
          onClick={() => setPass(false)}
        >
          ✕ 复核未通过，继续锁定
        </button>
      </div>
      <BaseFields value={base} onChange={setBase} operatorLabel="复核人" />
    </ModalCard>
  );
}

/* ------------------------------------------------------------- 新增样本 */

export interface NewSamplePayload extends CollectPayload {
  id: string;
  caseNo: string;
  species: string;
  stage: string;
}

export function NewSampleForm({
  samples,
  defaultOperator,
  onSubmit,
  onCancel,
}: {
  samples: Sample[];
  defaultOperator: string;
  onSubmit: (p: NewSamplePayload) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useBase(defaultOperator);
  const [caseNo, setCaseNo] = useState("");
  const [idManual, setIdManual] = useState("");
  const [species, setSpecies] = useState("");
  const [stage, setStage] = useState(DEVELOPMENT_STAGES[2]);
  const [f, setF] = useState({
    location: "",
    envTemp: "",
    exposure: EXPOSURE_STAGES[0],
    collectedAt: nowLocal(),
    preservation: PRESERVATIONS[0],
  });
  const [err, setErr] = useState("");

  const suggested = caseNo.trim()
    ? suggestSampleId(caseNo.trim().toUpperCase(), samples)
    : "";
  const finalId = idManual.trim() || suggested;
  const duplicate = samples.some((s) => s.id === finalId.trim().toUpperCase());

  const submit = () => {
    if (!caseNo.trim()) return setErr("请填写案件编号");
    if (!finalId.trim()) return setErr("请填写样本编号");
    if (duplicate) return setErr("样本编号已存在");
    if (!species.trim()) return setErr("请填写昆虫种类");
    if (base.operator.trim() === "" || base.at === "")
      return setErr("请填写经办人和经办时间");
    if (!f.location.trim()) return setErr("请填写采样地点");
    if (f.envTemp === "" || Number.isNaN(Number(f.envTemp)))
      return setErr("请填写现场环境温度");
    onSubmit({
      ...base,
      id: finalId.trim().toUpperCase(),
      caseNo: caseNo.trim().toUpperCase(),
      species: species.trim(),
      stage,
      location: f.location.trim(),
      envTemp: Number(f.envTemp),
      exposure: f.exposure,
      collectedAt: f.collectedAt,
      preservation: f.preservation,
    });
  };

  return (
    <ModalCard
      title="新建样本并采集登记"
      subtitle={
        <p className="modal-sub">
          建档即完成第一段「采集登记」，随后按 接收 → 鉴定 → 签发 顺序办理
        </p>
      }
      onClose={onCancel}
      onSubmit={submit}
      submitLabel="建档并提交采集登记"
      width={760}
    >
      <ErrorNote>{err}</ErrorNote>
      <TextField
        label="案件编号"
        required
        placeholder="如 CASE-042"
        value={caseNo}
        invalid={caseNo === ""}
        onChange={(e) => setCaseNo(e.target.value)}
      />
      <TextField
        label="样本编号"
        required
        placeholder={suggested || "按案件自动编号，可改"}
        value={idManual}
        invalid={duplicate}
        hint={
          duplicate
            ? "编号重复"
            : suggested
              ? `建议编号：${suggested}`
              : undefined
        }
        onChange={(e) => setIdManual(e.target.value)}
      />
      <TextField
        label="昆虫种类"
        required
        placeholder="如 丝光绿蝇 Lucilia sericata"
        value={species}
        invalid={species === ""}
        onChange={(e) => setSpecies(e.target.value)}
      />
      <SelectField
        label="发育阶段"
        required
        options={DEVELOPMENT_STAGES}
        value={stage}
        onChange={(e) => setStage(e.target.value)}
      />
      <TextField
        label="采样地点"
        required
        value={f.location}
        invalid={f.location === ""}
        onChange={(e) => setF({ ...f, location: e.target.value })}
      />
      <NumberField
        label="现场环境温度（℃）"
        required
        step={0.1}
        value={f.envTemp}
        invalid={f.envTemp === ""}
        onChange={(e) => setF({ ...f, envTemp: e.target.value })}
      />
      <SelectField
        label="尸体暴露阶段"
        required
        options={EXPOSURE_STAGES}
        value={f.exposure}
        onChange={(e) => setF({ ...f, exposure: e.target.value })}
      />
      <TextField
        label="采样时间"
        required
        type="datetime-local"
        step={1}
        value={f.collectedAt}
        onChange={(e) => setF({ ...f, collectedAt: e.target.value })}
      />
      <SelectField
        label="原始保存方式"
        required
        options={PRESERVATIONS}
        value={f.preservation}
        onChange={(e) => setF({ ...f, preservation: e.target.value })}
      />
      <BaseFields value={base} onChange={setBase} />
    </ModalCard>
  );
}
