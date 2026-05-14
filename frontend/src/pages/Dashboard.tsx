import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  Stethoscope,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useVisits,
  useHospitalizations,
  useBills,
  useBatches,
} from "@/hooks/useApiHooks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const today = new Date().toISOString().slice(0, 10);

// ==================== StatCard ====================

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Icon className="h-8 w-8 text-primary" />
        <div>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ==================== Admin ====================

function AdminDashboard() {
  const { data: visits, isLoading: visitsLoading } = useVisits();
  const { data: hosps, isLoading: hospsLoading } = useHospitalizations("住院中");
  const { data: bills, isLoading: billsLoading } = useBills();
  const { data: batches, isLoading: batchesLoading } = useBatches(10);

  const todayVisits = useMemo(
    () =>
      visits?.filter((v) => v.visit_time.slice(0, 10) === today).length ?? 0,
    [visits],
  );

  const activeHosps = useMemo(() => hosps?.length ?? 0, [hosps]);

  const todayRevenue = useMemo(() => {
    if (!bills) return "0.00";
    const sum = bills
      .filter(
        (b) => b.status === "已结清" && b.created_at.slice(0, 10) === today,
      )
      .reduce((acc, b) => acc + Number(b.total_amount ?? 0), 0);
    return sum.toFixed(2);
  }, [bills]);

  const lowStockCount = useMemo(() => batches?.length ?? 0, [batches]);

  const pendingVisits = useMemo(
    () =>
      visits
        ?.filter((v) => v.status === "待接诊")
        .sort((a, b) => a.visit_time.localeCompare(b.visit_time)) ?? [],
    [visits],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理仪表盘</h1>
        <p className="text-sm text-muted-foreground">医院运营数据概览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="今日挂号数"
          value={todayVisits}
          loading={visitsLoading}
        />
        <StatCard
          icon={Building2}
          label="在院数"
          value={activeHosps}
          loading={hospsLoading}
        />
        <StatCard
          icon={DollarSign}
          label="当日营收"
          value={`${todayRevenue}`}
          loading={billsLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="库存预警数"
          value={lowStockCount}
          loading={batchesLoading}
        />
      </div>

      {/* 待处理列表 */}
      <Card>
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-semibold">待处理列表</h2>
          <Badge variant="secondary">待接诊 {pendingVisits.length}</Badge>
        </div>
        <div className="p-4">
          {visitsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : pendingVisits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无待接诊记录
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>就诊编号</TableHead>
                  <TableHead>宠物ID</TableHead>
                  <TableHead>主诉</TableHead>
                  <TableHead>挂号时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVisits.map((v) => (
                  <TableRow key={v.visit_id}>
                    <TableCell className="font-mono">#{v.visit_id}</TableCell>
                    <TableCell>{v.pet_id}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {v.complaint ?? "-"}
                    </TableCell>
                    <TableCell>{v.visit_time.slice(0, 16)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

// ==================== Doctor ====================

function DoctorDashboard() {
  const { data: visits, isLoading } = useVisits();

  const pendingCount = useMemo(
    () => visits?.filter((v) => v.status === "待接诊").length ?? 0,
    [visits],
  );

  const inProgressCount = useMemo(
    () => visits?.filter((v) => v.status === "接诊中").length ?? 0,
    [visits],
  );

  const todayCompleted = useMemo(
    () =>
      visits?.filter(
        (v) => v.status === "已完成" && v.visit_time.slice(0, 10) === today,
      ).length ?? 0,
    [visits],
  );

  const queueVisits = useMemo(
    () =>
      visits
        ?.filter((v) => v.status === "待接诊")
        .sort((a, b) => a.visit_time.localeCompare(b.visit_time)) ?? [],
    [visits],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">医生工作台</h1>
        <p className="text-sm text-muted-foreground">今日诊疗概览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Clock}
          label="待接诊数"
          value={pendingCount}
          loading={isLoading}
        />
        <StatCard
          icon={Stethoscope}
          label="接诊中数"
          value={inProgressCount}
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="今日完成数"
          value={todayCompleted}
          loading={isLoading}
        />
      </div>

      {/* 候诊队列 */}
      <Card>
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-semibold">候诊队列</h2>
          <Badge variant="secondary">等待中 {queueVisits.length}</Badge>
        </div>
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : queueVisits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无候诊宠物
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>就诊编号</TableHead>
                  <TableHead>宠物ID</TableHead>
                  <TableHead>主诉</TableHead>
                  <TableHead>挂号时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueVisits.map((v) => (
                  <TableRow key={v.visit_id}>
                    <TableCell className="font-mono">#{v.visit_id}</TableCell>
                    <TableCell>{v.pet_id}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {v.complaint ?? "-"}
                    </TableCell>
                    <TableCell>{v.visit_time.slice(0, 16)}</TableCell>
                    <TableCell>
                      <Link
                        to={`/consultation/${v.visit_id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        接诊
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

// ==================== Nurse ====================

function NurseDashboard() {
  const { data: hosps, isLoading } = useHospitalizations("住院中");

  const activeCount = useMemo(() => hosps?.length ?? 0, [hosps]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">护理工作台</h1>
        <p className="text-sm text-muted-foreground">住院护理概览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={Building2}
          label="住院宠物数"
          value={activeCount}
          loading={isLoading}
        />
        <StatCard
          icon={ClipboardCheck}
          label="今日护理任务数"
          value={activeCount}
          loading={isLoading}
        />
      </div>

      {/* 护理任务列表 */}
      <Card>
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-lg font-semibold">护理任务列表</h2>
          <Badge variant="secondary">住院中 {activeCount}</Badge>
        </div>
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : activeCount === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无住院宠物
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>住院编号</TableHead>
                  <TableHead>就诊编号</TableHead>
                  <TableHead>病房号</TableHead>
                  <TableHead>入院日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hosps!.map((h) => (
                  <TableRow key={h.hosp_id}>
                    <TableCell className="font-mono">#{h.hosp_id}</TableCell>
                    <TableCell>{h.visit_id}</TableCell>
                    <TableCell>{h.ward_no}</TableCell>
                    <TableCell>{h.admit_date.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

// ==================== Dashboard entry ====================

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">请先登录</p>
      </div>
    );
  }

  switch (user.role) {
    case "管理员":
      return <AdminDashboard />;
    case "医生":
      return <DoctorDashboard />;
    case "护士":
      return <NurseDashboard />;
    default:
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">未知角色</p>
        </div>
      );
  }
}
