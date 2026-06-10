import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  Eye,
  Plus,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useHospitalizations,
  useWards,
  useVisits,
  useAdmit,
} from "@/hooks/useApiHooks";
import type { HospStatus, HospListOut } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/common/StatusBadge";

// Loading skeleton for table
function TableSkeleton({ rows = 5, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// 转入住院弹窗
function AdmitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: visits, isLoading: visitsLoading } = useVisits("待收费");
  const { data: wards, isLoading: wardsLoading } = useWards();
  const admit = useAdmit();

  const [visitId, setVisitId] = useState("");
  const [wardId, setWardId] = useState("");
  const [admitDate, setAdmitDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  // 仅空闲笼位
  const freeWards = (wards || []).filter((w) => w.status === "空闲");

  const handleSubmit = async () => {
    if (!visitId || !wardId || !admitDate) return;
    try {
      await admit.mutateAsync({
        visit_id: parseInt(visitId),
        ward_id: parseInt(wardId),
        admit_date: admitDate,
      });
      toast.success("入院登记成功");
      setVisitId("");
      setWardId("");
      setAdmitDate(new Date().toISOString().slice(0, 10));
      onOpenChange(false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>转入住院</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>就诊记录</Label>
            <Select value={visitId} onValueChange={(v) => setVisitId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择待收费的就诊" />
              </SelectTrigger>
              <SelectContent>
                {visitsLoading ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    加载中...
                  </div>
                ) : !visits?.length ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    暂无待收费的就诊记录
                  </div>
                ) : (
                  visits.map((v) => (
                    <SelectItem key={v.visit_id} value={String(v.visit_id)}>
                      #{v.visit_id} - 宠物#{v.pet_id}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>笼位</Label>
            <Select value={wardId} onValueChange={(v) => setWardId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择笼位" />
              </SelectTrigger>
              <SelectContent>
                {wardsLoading ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    加载中...
                  </div>
                ) : freeWards.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    暂无空闲笼位
                  </div>
                ) : (
                  freeWards.map((w) => (
                    <SelectItem key={w.ward_id} value={String(w.ward_id)}>
                      {w.ward_no} ({w.type}, {Number(w.daily_rate).toFixed(0)}元/天)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admit-date">入院日期</Label>
            <Input
              id="admit-date"
              type="date"
              value={admitDate}
              onChange={(e) => setAdmitDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={admit.isPending}
          >
            {admit.isPending && <Loader2 className="animate-spin" />}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 住院列表表格
function HospTable({
  data,
  isLoading,
  onViewClick,
}: {
  data: HospListOut[];
  isLoading: boolean;
  onViewClick: (id: number) => void;
}) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={8} />;
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Building2 className="size-10 mb-2 opacity-30" />
        <p className="text-sm">暂无住院记录</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>住院ID</TableHead>
          <TableHead>就诊ID</TableHead>
          <TableHead>笼位号</TableHead>
          <TableHead>笼位类型</TableHead>
          <TableHead>入院日期</TableHead>
          <TableHead>出院日期</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((h) => (
          <TableRow key={h.hosp_id}>
            <TableCell className="text-muted-foreground">
              #{h.hosp_id}
            </TableCell>
            <TableCell>#{h.visit_id}</TableCell>
            <TableCell>{h.ward_no}</TableCell>
            <TableCell>{h.ward_type}</TableCell>
            <TableCell>{h.admit_date.slice(0, 10)}</TableCell>
            <TableCell>
              {h.discharge_date ? h.discharge_date.slice(0, 10) : "-"}
            </TableCell>
            <TableCell>
              <StatusBadge status={h.status} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onViewClick(h.hosp_id)}
                >
                  <Eye className="size-3.5" />
                  查看
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function HospList() {
  const navigate = useNavigate();
  const isAdminOrDoctor = useAuthStore((s) => {
    const role = s.user?.role;
    return role === "管理员" || role === "医生";
  });
  const [tab, setTab] = useState("all");
  const [showAdmit, setShowAdmit] = useState(false);

  // 根据 tab 过滤状态
  const statusFilter: HospStatus | undefined =
    tab === "all" ? undefined : (tab as HospStatus);

  const { data: hospitalizations, isLoading } =
    useHospitalizations(statusFilter);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              住院管理
            </CardTitle>
            {isAdminOrDoctor && (
              <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setShowAdmit(true)}>
                <Plus className="size-4" />
                转入住院
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="住院中">住院中</TabsTrigger>
              <TabsTrigger value="已出院">已出院</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-4">
            <HospTable
              data={hospitalizations || []}
              isLoading={isLoading}
              onViewClick={(id) => navigate(`/hospitalization/${id}`)}
            />
          </div>
        </CardContent>
      </Card>

      <AdmitDialog open={showAdmit} onOpenChange={setShowAdmit} />
    </div>
  );
}
