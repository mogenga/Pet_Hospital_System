import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Loader2,
  ClipboardList,
  Plus,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useHospDetail,
  useAddNursing,
  useDischarge,
} from "@/hooks/useApiHooks";
import type { NursingRecord } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";

// 详情字段子组件
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// 添加护理记录表单
function AddNursingForm({ hospId }: { hospId: number }) {
  const employeeId = useAuthStore((s) => s.user?.employee_id);
  const addNursing = useAddNursing();
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!content.trim() || !employeeId) return;
    try {
      await addNursing.mutateAsync({
        hospId,
        data: {
          employee_id: employeeId,
          content: content.trim(),
        },
      });
      toast.success("护理记录已添加");
      setContent("");
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <Plus className="size-4" />
        添加护理记录
      </h4>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nursing-content">护理内容</Label>
        <Textarea
          id="nursing-content"
          placeholder="请输入护理内容..."
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || addNursing.isPending}
        >
          {addNursing.isPending && <Loader2 className="animate-spin" />}
          提交
        </Button>
      </div>
    </div>
  );
}

export default function HospDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const hospId = Number(id);
  const { data: hosp, isLoading } = useHospDetail(
    Number.isNaN(hospId) ? undefined : hospId
  );
  const discharge = useDischarge();
  const [showDischarge, setShowDischarge] = useState(false);

  const handleDischarge = async () => {
    if (!hosp) return;
    try {
      await discharge.mutateAsync(hosp.hosp_id);
      toast.success("出院成功，住院费已自动生成");
      setShowDischarge(false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    }
  };

  // 加载态
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-24" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 不存在
  if (!hosp) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Building2 className="size-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">住院记录不存在</p>
        <Button variant="outline" onClick={() => navigate("/hospitalization")}>
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
      </div>
    );
  }

  const isActive = hosp.status === "住院中";
  const nursingRecords: NursingRecord[] = hosp.nursing_records || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => navigate("/hospitalization")}
      >
        <ArrowLeft className="size-4" />
        返回住院列表
      </Button>

      {/* 住院信息卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              住院详情
            </CardTitle>
            <StatusBadge status={hosp.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailItem label="住院ID" value={`#${hosp.hosp_id}`} />
            <DetailItem label="就诊ID" value={`#${hosp.visit_id}`} />
            <DetailItem label="笼位号" value={hosp.ward_no} />
            <DetailItem label="笼位类型" value={hosp.ward_type} />
            <DetailItem
              label="入院日期"
              value={hosp.admit_date.slice(0, 10)}
            />
            <DetailItem
              label="出院日期"
              value={
                hosp.discharge_date
                  ? hosp.discharge_date.slice(0, 10)
                  : "-"
              }
            />
          </div>

          {/* 出院按钮 */}
          {isActive && isAdmin && (
            <div className="mt-6 flex justify-end">
              <Button
                variant="destructive"
                onClick={() => setShowDischarge(true)}
              >
                <LogOut className="size-4" />
                出院
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 护理记录卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            护理记录
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* 添加护理记录表单（所有角色均可添加） */}
          {isActive && <AddNursingForm hospId={hosp.hosp_id} />}

          {/* 护理记录表格 */}
          {nursingRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ClipboardList className="size-8 mb-2 opacity-30" />
              <p className="text-sm">暂无护理记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>护士</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>护理内容</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nursingRecords.map((r) => (
                  <TableRow key={r.record_id}>
                    <TableCell className="font-medium">
                      {r.nurse_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {r.record_time.slice(0, 16)}
                    </TableCell>
                    <TableCell>{r.content}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 出院确认弹窗 */}
      <ConfirmDialog
        open={showDischarge}
        onOpenChange={setShowDischarge}
        title="确认出院"
        description={`确认将住院记录 #${hosp.hosp_id} 办理出院吗？出院后系统将自动生成住院费用账单。`}
        confirmLabel="确认出院"
        variant="destructive"
        onConfirm={handleDischarge}
        loading={discharge.isPending}
      />
    </div>
  );
}
