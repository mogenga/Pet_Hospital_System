import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Receipt, DollarSign, FileText, Loader2, Download } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBillDetail, useSettleBill } from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export default function BillingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const billId = Number(id);
  const { data: bill, isLoading } = useBillDetail(
    Number.isNaN(billId) ? undefined : billId
  );
  const settleBill = useSettleBill();

  const [showSettleConfirm, setShowSettleConfirm] = useState(false);

  const handleSettle = async () => {
    if (!bill) return;
    try {
      await settleBill.mutateAsync(bill.bill_id);
      toast.success(`账单 #${bill.bill_id} 已结清`);
      setShowSettleConfirm(false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    }
  };

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
              {Array.from({ length: 5 }).map((_, i) => (
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Receipt className="size-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">账单不存在</p>
        <Button variant="outline" onClick={() => navigate("/billing")}>
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => navigate("/billing")}
      >
        <ArrowLeft className="size-4" />
        返回列表
      </Button>

      {/* 账单信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            账单详情
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailItem label="账单ID" value={`#${bill.bill_id}`} />
            <DetailItem label="就诊ID" value={`#${bill.visit_id}`} />
            <DetailItem
              label="状态"
              value={<StatusBadge status={bill.status} />}
              isNode
            />
            <DetailItem
              label="创建时间"
              value={bill.created_at.slice(0, 16)}
            />
          </div>

          {/* 总金额 */}
          <div className="mt-6 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="size-4" />
                总金额
              </div>
              <div className="text-xl font-bold">
                {Number(bill.total_amount).toFixed(2)} 元
              </div>
            </div>
          </div>

          {/* 结账确认弹窗 */}
          <ConfirmDialog
            open={showSettleConfirm}
            onOpenChange={setShowSettleConfirm}
            title="确认结账"
            description={`确认对账单 #${bill.bill_id} 进行结账吗？结账后状态将不可更改。`}
            confirmLabel="确认结账"
            onConfirm={handleSettle}
            loading={settleBill.isPending}
          />
        </CardContent>
      </Card>

      {/* 收费项卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              收费项
            </CardTitle>
            {bill.status === "未结清" && isAdmin && (
              <Button
                onClick={() => setShowSettleConfirm(true)}
                disabled={settleBill.isPending}
              >
                {settleBill.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                结账
              </Button>
            )}
            {bill.status === "已结清" && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `http://localhost:8000/api/billing/bills/${bill.bill_id}/download`,
                      { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } }
                    );
                    const data = await res.json();
                    window.open(data.url, "_blank");
                  } catch {
                    toast.error("下载失败");
                  }
                }}
              >
                <Download className="size-4" />
                下载PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {bill.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="size-10 mb-2 opacity-30" />
              <p className="text-sm">暂无收费项</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>来源类型</TableHead>
                  <TableHead>来源ID</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.items.map((item) => (
                  <TableRow key={item.bill_item_id}>
                    <TableCell className="font-medium">
                      {item.item_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.source_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      #{item.source_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(item.amount).toFixed(2)} 元
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 详情字段子组件
function DetailItem({
  label,
  value,
  isNode = false,
}: {
  label: string;
  value: string | React.ReactNode;
  isNode?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {isNode ? (
        <span>{value}</span>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}
