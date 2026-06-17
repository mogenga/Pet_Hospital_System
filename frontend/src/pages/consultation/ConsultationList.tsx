import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Eye, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useVisits,
  useCreateVisit,
  useCustomers,
  useEmployees,
} from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

const TAB_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "待接诊", label: "待接诊" },
  { value: "接诊中", label: "接诊中" },
  { value: "待收费", label: "待收费" },
  { value: "已完成", label: "已完成" },
  { value: "已取消", label: "已取消" },
] as const;

export default function ConsultationList() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");

  const [activeTab, setActiveTab] = useState<string>("all");
  const statusParam = activeTab === "all" ? undefined : activeTab;
  const { data: visits, isLoading, isError } = useVisits(statusParam);

  const { data: customers } = useCustomers();
  const { data: employees } = useEmployees();
  const createVisit = useCreateVisit();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [complaint, setComplaint] = useState("");

  const doctors = (employees || []).filter((e) => e.role === "医生");
  const selectedCustomer = customers?.find(
    (c) => c.customer_id === Number(selectedCustomerId)
  );
  const selectedPet = selectedCustomer?.pets.find(
    (p) => p.pet_id === Number(selectedPetId)
  );
  const selectedDoctor = doctors.find(
    (d) => d.employee_id === Number(selectedDoctorId)
  );
  // 计算显示标签，避免 Select 组件直接显示原始 ID
  const customerLabel = selectedCustomer
    ? `${selectedCustomer.name} (${selectedCustomer.phone})`
    : "";
  const petLabel = selectedPet
    ? `${selectedPet.name} (${selectedPet.species}${selectedPet.breed ? ` - ${selectedPet.breed}` : ""})`
    : "";
  const doctorLabel = selectedDoctor ? selectedDoctor.name : "";

  const resetForm = () => {
    setSelectedCustomerId("");
    setSelectedPetId("");
    setSelectedDoctorId("");
    setComplaint("");
  };

  const handleCreate = () => {
    if (!selectedPetId || !selectedDoctorId) return;
    createVisit.mutate(
      {
        pet_id: Number(selectedPetId),
        employee_id: Number(selectedDoctorId),
        complaint: complaint.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("挂号成功");
          setShowCreate(false);
          resetForm();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">就诊管理</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
          >
            <Plus className="size-4" />
            新增挂号
          </Button>
        )}
      </div>

      {/* 状态筛选标签页 */}
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value)}
      >
        <TabsList>
          {TAB_OPTIONS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 表格 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          加载失败，请刷新重试
        </p>
      ) : !visits?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">暂无就诊记录</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>就诊ID</TableHead>
              <TableHead>宠物名称</TableHead>
              <TableHead>客户名称</TableHead>
              <TableHead>主诉</TableHead>
              <TableHead>挂号时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((v) => (
              <TableRow key={v.visit_id}>
                <TableCell className="text-muted-foreground">
                  #{v.visit_id}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.pet_name || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.customer_name || "-"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {v.complaint || "-"}
                </TableCell>
                <TableCell>{v.visit_time.slice(0, 16)}</TableCell>
                <TableCell>
                  <StatusBadge status={v.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => navigate(`/consultation/${v.visit_id}`)}
                  >
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 底部统计 */}
      {visits && (
        <p className="text-sm text-muted-foreground">
          共 {visits.length} 条记录
        </p>
      )}

      {/* 新增挂号弹窗 */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            resetForm();
          } else {
            setShowCreate(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增挂号</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {/* 选择客户 */}
            <div className="flex flex-col gap-1.5">
              <Label>选择客户</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value ?? "");
                  setSelectedPetId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择客户">
                    {customerLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(customers || []).map((c) => (
                    <SelectItem
                      key={c.customer_id}
                      value={String(c.customer_id)}
                    >
                      {c.name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 选择宠物（嵌套在客户下） */}
            <div className="flex flex-col gap-1.5">
              <Label>选择宠物</Label>
              <Select
                value={selectedPetId}
                onValueChange={(v) => setSelectedPetId(v ?? "")}
                disabled={!selectedCustomerId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      selectedCustomerId ? "请选择宠物" : "请先选择客户"
                    }
                  >
                    {petLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(selectedCustomer?.pets || []).map((p) => (
                    <SelectItem key={p.pet_id} value={String(p.pet_id)}>
                      {p.name} ({p.species}
                      {p.breed ? ` - ${p.breed}` : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 选择接诊医生 */}
            <div className="flex flex-col gap-1.5">
              <Label>接诊医生</Label>
              <Select
                value={selectedDoctorId}
                onValueChange={(v) => setSelectedDoctorId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择医生">
                    {doctorLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem
                      key={d.employee_id}
                      value={String(d.employee_id)}
                    >
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 主诉 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visit-complaint">主诉</Label>
              <Textarea
                id="visit-complaint"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="请输入主诉（选填）"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={
                !selectedPetId || !selectedDoctorId || createVisit.isPending
              }
            >
              {createVisit.isPending && <Loader2 className="animate-spin" />}
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
