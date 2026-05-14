import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PawPrint, Home, Calendar, DollarSign } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBoardingDetail, useEndBoarding } from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoardingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const boardingId = Number(id);
  const { data: boarding, isLoading } = useBoardingDetail(
    Number.isNaN(boardingId) ? undefined : boardingId
  );
  const endBoarding = useEndBoarding();

  const handleEnd = async () => {
    if (!boarding) return;
    try {
      const data = await endBoarding.mutateAsync(boarding.boarding_id);
      toast.success(
        `寄养已结束：共寄养 ${data.days} 天，费用 ${Number(data.total_fee).toFixed(2)} 元`
      );
    } catch {
      // 错误提示已在 apiClient 拦截器中处理
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
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!boarding) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <PawPrint className="size-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">寄养记录不存在</p>
        <Button variant="outline" onClick={() => navigate("/boarding")}>
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
      </div>
    );
  }

  const isOngoing = !boarding.end_date;

  // 计算当前天数
  const startDate = new Date(boarding.start_date);
  const endDate = boarding.end_date ? new Date(boarding.end_date) : new Date();
  const daysElapsed = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => navigate("/boarding")}
      >
        <ArrowLeft className="size-4" />
        返回寄养列表
      </Button>

      {/* 详情卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Home className="size-5" />
              寄养详情
            </CardTitle>
            <Badge variant={isOngoing ? "default" : "secondary"}>
              {isOngoing ? "进行中" : "已结束"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailItem label="寄养ID" value={`#${boarding.boarding_id}`} />
            <DetailItem label="宠物名" value={boarding.pet_name} />
            <DetailItem label="笼位号" value={boarding.ward_no} />
            <DetailItem
              label="日费率"
              value={`${Number(boarding.daily_rate).toFixed(2)} 元/天`}
            />
            <DetailItem
              label="开始日期"
              value={boarding.start_date.slice(0, 10)}
            />
            <DetailItem
              label="结束日期"
              value={
                boarding.end_date
                  ? boarding.end_date.slice(0, 10)
                  : "进行中"
              }
            />
          </div>

          {/* 费用信息 */}
          <div className="mt-6 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="size-4" />
                {isOngoing ? "当前费用" : "费用合计"}
              </div>
              <div className="text-lg font-semibold">
                {Number(boarding.current_fee).toFixed(2)} 元
              </div>
            </div>
            {isOngoing && (
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {Number(boarding.daily_rate).toFixed(2)} 元/天 x {daysElapsed} 天
                </span>
                <Calendar className="size-3.5" />
              </div>
            )}
          </div>

          {/* 结束寄养按钮 */}
          {isOngoing && isAdmin && (
            <div className="mt-6 flex justify-end">
              <Button
                variant="destructive"
                onClick={handleEnd}
                disabled={endBoarding.isPending}
              >
                {endBoarding.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                结束寄养
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 详情字段子组件
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
