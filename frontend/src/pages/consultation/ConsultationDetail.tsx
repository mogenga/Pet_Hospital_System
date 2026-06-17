import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  FileText,
  Stethoscope,
  Pill,
  Receipt,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useVisitDetail,
  useAcceptVisit,
  useCreateDiagnosis,
  useCreatePrescription,
  useCancelVisit,
  useCompleteVisit,
  useAddBillItem,
  useBatches,
  useMedicines,
} from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { PrescriptionDetail, DiagnosisOut, BatchOut, MedicineOut } from "@/types";

// ---- 单行处方 ----
interface PrescriptionRow {
  key: number;
  batchId: string;
  quantity: string;
  dosage: string;
}

// ---- 计算金额 ----
function calcAmount(
  item: PrescriptionDetail,
  batches: BatchOut[],
  medicines: MedicineOut[]
): number {
  const batch = batches.find((b) => b.batch_id === item.batch_id);
  if (!batch) return 0;
  const medicine = medicines.find((m) => m.medicine_id === batch.medicine_id);
  return (medicine?.unit_price ?? 0) * item.quantity;
}

// ---- 诊断信息展示 ----
function DiagnosisInfo({ diagnosis }: { diagnosis: DiagnosisOut }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Stethoscope className="size-4 text-primary" />
        诊断结果
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {diagnosis.diagnosis_result}
      </p>
      {diagnosis.notes && (
        <div className="pt-1">
          <span className="text-xs font-medium text-muted-foreground">
            备注：
          </span>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {diagnosis.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- 处方列表展示 ----
function PrescriptionTable({
  prescriptions,
  batches,
  medicines,
  showAmount,
}: {
  prescriptions: PrescriptionDetail[];
  batches: BatchOut[];
  medicines: MedicineOut[];
  showAmount?: boolean;
}) {
  if (prescriptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        暂无处方
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>药品名称</TableHead>
          <TableHead>数量</TableHead>
          <TableHead>用法用量</TableHead>
          {showAmount && <TableHead className="text-right">金额</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {prescriptions.map((item) => (
          <TableRow key={item.item_id}>
            <TableCell className="font-medium">
              {item.medicine_name}
            </TableCell>
            <TableCell>{item.quantity}</TableCell>
            <TableCell>{item.dosage || "-"}</TableCell>
            {showAmount && (
              <TableCell className="text-right">
                {calcAmount(item, batches, medicines).toFixed(2)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const visitId = Number(id);

  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === "医生";
  const isAdmin = user?.role === "管理员";

  const {
    data: visitDetail,
    isLoading,
    isError,
  } = useVisitDetail(isNaN(visitId) ? undefined : visitId);
  const { data: batches } = useBatches();
  const { data: medicines } = useMedicines();

  const acceptVisit = useAcceptVisit();
  const createDiagnosis = useCreateDiagnosis();
  const createPrescription = useCreatePrescription();
  const cancelVisit = useCancelVisit();
  const completeVisit = useCompleteVisit();
  const addBillItem = useAddBillItem();

  // 诊断表单
  const [diagnosisResult, setDiagnosisResult] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");

  // 处方表单
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionRow[]>(
    []
  );
  const rowKeyRef = useRef(0);  // 用 ref 避免闭包过期导致 key 重复

  // 生成收费项 loading
  const [generatingBill, setGeneratingBill] = useState(false);

  // 取消确认
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ---- 无效 ID ----
  if (isNaN(visitId)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">无效的就诊ID</p>
        <Button
          variant="link"
          className="mt-2"
          onClick={() => navigate("/consultation")}
        >
          返回列表
        </Button>
      </div>
    );
  }

  // ---- 加载中 ----
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  // ---- 加载失败 ----
  if (isError || !visitDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">加载失败，请刷新重试</p>
        <Button
          variant="link"
          className="mt-2"
          onClick={() => navigate("/consultation")}
        >
          返回列表
        </Button>
      </div>
    );
  }

  const { status, diagnosis, prescriptions } = visitDetail;
  const availableBatches = (batches || []).filter((b) => b.stock_qty > 0);
  const hasPrescriptions = prescriptions.length > 0;

  // ---- 接诊 ----
  const handleAccept = () => {
    acceptVisit.mutate(visitId, {
      onSuccess: () => toast.success("接诊成功，开始诊断"),
    });
  };

  // ---- 提交诊断 ----
  const handleSubmitDiagnosis = () => {
    if (!diagnosisResult.trim()) return;
    createDiagnosis.mutate(
      {
        visitId,
        data: {
          diagnosis_result: diagnosisResult.trim(),
          notes: diagnosisNotes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("诊断提交成功");
          setDiagnosisResult("");
          setDiagnosisNotes("");
        },
      }
    );
  };

  // ---- 处方行操作 ----
  const addPrescriptionRow = () => {
    const key = ++rowKeyRef.current;  // ref 自增保证绝对唯一，无闭包过期问题
    setPrescriptionRows((prev) => [
      ...prev,
      { key, batchId: "", quantity: "", dosage: "" },
    ]);
  };

  const removePrescriptionRow = (key: number) => {
    setPrescriptionRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateRow = (
    key: number,
    field: keyof PrescriptionRow,
    value: string
  ) => {
    setPrescriptionRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  // ---- 提交处方 ----
  const handleSubmitPrescription = () => {
    if (!diagnosis) return;

    // 先检查是否有空行（用户点击了"添加处方"但未填写）
    const emptyRows = prescriptionRows.filter(
      (r) => !r.batchId || !r.quantity
    );
    if (prescriptionRows.length > 0 && emptyRows.length === prescriptionRows.length) {
      // 所有行都不完整
      const missingBatch = emptyRows.some((r) => !r.batchId);
      const missingQty = emptyRows.some((r) => !r.quantity);
      const hint = [];
      if (missingBatch) hint.push("选择药品");
      if (missingQty) hint.push("填写数量");
      toast.error(`请${hint.join("并")}`);
      return;
    }

    const items = prescriptionRows
      .filter((r) => r.batchId && r.quantity)
      .map((r) => ({
        batch_id: Number(r.batchId),
        quantity: Number(r.quantity),
        dosage: r.dosage.trim() || null,
      }));

    if (items.length === 0) {
      toast.error("请至少填写一条处方信息");
      return;
    }

    createPrescription.mutate(
      {
        diagnosisId: diagnosis.diagnosis_id,
        data: { items },
      },
      {
        onSuccess: () => {
          toast.success("处方提交成功");
          setPrescriptionRows([]);
        },
      }
    );
  };

  // ---- 生成收费项 ----
  const handleGenerateBillItems = async () => {
    if (!hasPrescriptions) return;
    setGeneratingBill(true);

    const priceMap = new Map<number, number>();
    (medicines || []).forEach((m) =>
      priceMap.set(m.medicine_id, m.unit_price)
    );

    let successCount = 0;
    for (const item of prescriptions) {
      const batch = (batches || []).find((b) => b.batch_id === item.batch_id);
      if (!batch) continue;
      const unitPrice = priceMap.get(batch.medicine_id) ?? 0;
      const amount = unitPrice * item.quantity;

      try {
        await addBillItem.mutateAsync({
          visitId,
          data: {
            item_type: "药品费",
            source_type: "prescription_item",
            source_id: item.item_id,
            amount,
            description: `${item.medicine_name} x${item.quantity}`,
          },
        });
        successCount++;
      } catch {
        // 已存在的收费项跳过
      }
    }

    setGeneratingBill(false);
    if (successCount > 0) {
      toast.success(`已生成 ${successCount} 条收费项`);
      qc.invalidateQueries({ queryKey: ["visits"] });
    }
  };

  // ---- 取消就诊 ----
  const handleCancel = () => {
    cancelVisit.mutate(visitId, {
      onSuccess: () => {
        toast.success("就诊已取消");
        setShowCancelConfirm(false);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/consultation")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-lg font-semibold">就诊详情</h1>
        </div>
        <StatusBadge status={status} className="text-sm px-3 py-1" />
      </div>

      {/* ---- 信息卡片 ---- */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* 宠物信息 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                宠物信息
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">
                  {visitDetail.pet_name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {visitDetail.species}
                  {visitDetail.breed ? ` / ${visitDetail.breed}` : ""}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                主人：{visitDetail.customer_name}
              </span>
            </div>

            {/* 就诊信息 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                就诊信息
              </span>
              <span className="text-sm">
                接诊医生：{visitDetail.doctor_name}
              </span>
              <span className="text-sm text-muted-foreground">
                挂号时间：{visitDetail.visit_time.slice(0, 16)}
              </span>
              {visitDetail.complaint && (
                <div className="mt-1 rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">
                    {visitDetail.complaint}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- 操作区域 ---- */}

      {/* 待接诊 */}
      {status === "待接诊" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="size-4" />
              等待接诊
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDoctor ? (
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAccept}
                  disabled={acceptVisit.isPending}
                >
                  {acceptVisit.isPending && (
                    <Loader2 className="animate-spin" />
                  )}
                  接诊
                </Button>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <Ban className="size-4" />
                    取消就诊
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                等待医生接诊中...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 接诊中 */}
      {status === "接诊中" && (
        <div className="flex flex-col gap-4">
          {/* 诊断区域 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="size-4" />
                诊断
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diagnosis ? (
                <DiagnosisInfo diagnosis={diagnosis} />
              ) : isDoctor ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="diagnosis-result">
                      诊断结果 <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="diagnosis-result"
                      value={diagnosisResult}
                      onChange={(e) => setDiagnosisResult(e.target.value)}
                      placeholder="请输入诊断结果"
                      rows={4}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="diagnosis-notes">备注</Label>
                    <Textarea
                      id="diagnosis-notes"
                      value={diagnosisNotes}
                      onChange={(e) => setDiagnosisNotes(e.target.value)}
                      placeholder="备注信息（选填）"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Button
                      onClick={handleSubmitDiagnosis}
                      disabled={
                        !diagnosisResult.trim() || createDiagnosis.isPending
                      }
                    >
                      {createDiagnosis.isPending && (
                        <Loader2 className="animate-spin" />
                      )}
                      提交诊断
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  等待医生诊断中...
                </p>
              )}
            </CardContent>
          </Card>

          {/* 处方区域（仅在诊断存在后显示） */}
          {diagnosis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="size-4" />
                  处方
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* 已有处方 */}
                {hasPrescriptions && (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      已开处方
                    </span>
                    <PrescriptionTable
                      prescriptions={prescriptions}
                      batches={batches || []}
                      medicines={medicines || []}
                      showAmount={isDoctor}
                    />
                  </div>
                )}

                {hasPrescriptions && <Separator />}

                {/* 添加处方表单（仅医生） */}
                {isDoctor ? (
                  <>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          添加处方
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addPrescriptionRow}
                        >
                          <Plus className="size-3.5" />
                          添加处方
                        </Button>
                      </div>

                      {prescriptionRows.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {prescriptionRows.map((row) => (
                            <div
                              key={row.key}
                              className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
                            >
                              <div className="flex flex-1 flex-col gap-1 min-w-[160px]">
                                <Label className="text-xs">药品</Label>
                                <Select
                                  value={row.batchId}
                                  onValueChange={(v) =>
                                    updateRow(row.key, "batchId", v ?? "")
                                  }
                                >
                                  <SelectTrigger size="sm" className="w-full">
                                    <SelectValue placeholder="选择药品批次">
                                      {(() => {
                                        const b = availableBatches.find(
                                          (ab) => String(ab.batch_id) === row.batchId
                                        );
                                        return b ? `${b.medicine_name} (#${b.batch_id})` : undefined;
                                      })()}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableBatches.map((b) => (
                                      <SelectItem
                                        key={b.batch_id}
                                        value={String(b.batch_id)}
                                      >
                                        {b.medicine_name} (#{b.batch_id})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-col gap-1 w-20">
                                <Label className="text-xs">数量</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-7"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateRow(row.key, "quantity", e.target.value)
                                  }
                                  placeholder="1"
                                />
                              </div>
                              <div className="flex flex-1 flex-col gap-1 min-w-[120px]">
                                <Label className="text-xs">用法用量</Label>
                                <Input
                                  type="text"
                                  className="h-7"
                                  value={row.dosage}
                                  onChange={(e) =>
                                    updateRow(row.key, "dosage", e.target.value)
                                  }
                                  placeholder="如：每日两次，每次一片"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0"
                                onClick={() => removePrescriptionRow(row.key)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {prescriptionRows.length > 0 && (
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={handleSubmitPrescription}
                            disabled={createPrescription.isPending}
                          >
                            {createPrescription.isPending && (
                              <Loader2 className="animate-spin" />
                            )}
                            提交处方
                          </Button>
                        </div>
                      )}

                      {/* 完成诊疗 */}
                      {diagnosis && hasPrescriptions && (
                        <>
                          <Separator />
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              诊疗完成
                            </span>
                            <div>
                              <Button
                                variant="default"
                                onClick={() => {
                                  completeVisit.mutate(visitId, {
                                    onSuccess: () => toast.success("诊疗完成，已进入收费阶段"),
                                  });
                                }}
                                disabled={completeVisit.isPending}
                              >
                                {completeVisit.isPending && (
                                  <Loader2 className="animate-spin" />
                                )}
                                <CheckCircle2 className="size-4" />
                                完成诊疗
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 生成收费项 */}
                    {hasPrescriptions && (
                      <>
                        <Separator />
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            费用结算
                          </span>
                          <div>
                            <Button
                              variant="secondary"
                              onClick={handleGenerateBillItems}
                              disabled={generatingBill}
                            >
                              {generatingBill ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Receipt className="size-4" />
                              )}
                              生成收费项
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  /* 非医生查看处方 */
                  hasPrescriptions ? (
                    <PrescriptionTable
                      prescriptions={prescriptions}
                      batches={batches || []}
                      medicines={medicines || []}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      暂无处方
                    </p>
                  )
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 待收费 */}
      {status === "待收费" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="size-4" />
                诊断与处方
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {diagnosis ? (
                <DiagnosisInfo diagnosis={diagnosis} />
              ) : (
                <p className="text-sm text-muted-foreground">暂无诊断记录</p>
              )}
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  处方明细
                </span>
                <PrescriptionTable
                  prescriptions={prescriptions}
                  batches={batches || []}
                  medicines={medicines || []}
                  showAmount
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/billing")}>
              <Receipt className="size-4" />
              查看账单
            </Button>
          </div>
        </div>
      )}

      {/* 已完成 */}
      {status === "已完成" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              就诊记录
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {diagnosis ? (
              <DiagnosisInfo diagnosis={diagnosis} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无诊断记录</p>
            )}
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                处方明细
              </span>
              <PrescriptionTable
                prescriptions={prescriptions}
                batches={batches || []}
                medicines={medicines || []}
                showAmount
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 已取消 */}
      {status === "已取消" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ban className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">该就诊已取消</p>
          </CardContent>
        </Card>
      )}

      {/* 取消就诊确认 */}
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="确认取消就诊"
        description="确定要取消本次就诊吗？此操作不可撤销。"
        confirmLabel="确认取消"
        variant="destructive"
        onConfirm={handleCancel}
        loading={cancelVisit.isPending}
      />
    </div>
  );
}
