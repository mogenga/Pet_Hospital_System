import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  LogOut,
  Home,
  Loader2,
  PawPrint,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useBoardings,
  useCreateBoarding,
  useEndBoarding,
  useCustomers,
  useWards,
} from "@/hooks/useApiHooks";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ImageUpload from "@/components/common/ImageUpload";

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
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

// 新增寄养弹窗
function AddBoardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: customers } = useCustomers();
  const { data: wards } = useWards();
  const createBoarding = useCreateBoarding();

  const [petId, setPetId] = useState("");
  const [wardId, setWardId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);

  // 展平所有客户的宠物为下拉选项
  const allPets = (customers || []).flatMap((c) =>
    c.pets.map((p) => ({
      pet_id: p.pet_id,
      label: `${p.name} (${c.name})`,
    }))
  );

  // 仅空闲笼位
  const freeWards = (wards || []).filter((w) => w.status === "空闲");

  const handleSubmit = async () => {
    if (!petId || !wardId || !startDate) return;
    try {
      await createBoarding.mutateAsync({
        pet_id: parseInt(petId),
        ward_id: parseInt(wardId),
        start_date: startDate,
        photo_key: photoKey,
      });
      toast.success("寄养登记成功");
      setPetId("");
      setWardId("");
      setStartDate("");
      setPhotoKey(null);
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
          <DialogTitle>新增寄养</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>宠物</Label>
            <Select value={petId} onValueChange={(v) => setPetId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择宠物" />
              </SelectTrigger>
              <SelectContent>
                {allPets.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    暂无宠物数据
                  </div>
                ) : (
                  allPets.map((p) => (
                    <SelectItem key={p.pet_id} value={String(p.pet_id)}>
                      {p.label}
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
                {freeWards.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    暂无空闲笼位
                  </div>
                ) : (
                  freeWards.map((w) => (
                    <SelectItem key={w.ward_id} value={String(w.ward_id)}>
                      {w.ward_no} ({w.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="boarding-start-date">开始日期</Label>
            <Input
              id="boarding-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>宠物照片</Label>
            <ImageUpload
              fileKey={`boarding/${Date.now()}/checkin.jpg`}
              currentKey={photoKey}
              onSuccess={(key) => setPhotoKey(key)}
              allowed={true}
              size="md"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={createBoarding.isPending}
          >
            {createBoarding.isPending && (
              <Loader2 className="animate-spin" />
            )}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BoardingList() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const { data: boardings, isLoading } = useBoardings();
  const endBoarding = useEndBoarding();
  const [showAdd, setShowAdd] = useState(false);

  // 结束寄养确认
  const [endTarget, setEndTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleEnd = async () => {
    if (!endTarget) return;
    try {
      const data = await endBoarding.mutateAsync(endTarget.id);
      toast.success(
        `寄养已结束：共寄养 ${data.days} 天，费用 ${Number(data.total_fee).toFixed(2)} 元`
      );
      setEndTarget(null);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Home className="size-5" />
              寄养管理
            </CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="size-4" />
                新增寄养
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : !boardings?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PawPrint className="size-10 mb-2 opacity-30" />
              <p className="text-sm">暂无寄养记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>寄养ID</TableHead>
                  <TableHead>宠物名</TableHead>
                  <TableHead>笼位号</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boardings.map((b) => (
                  <TableRow key={b.boarding_id}>
                    <TableCell className="text-muted-foreground">
                      #{b.boarding_id}
                    </TableCell>
                    <TableCell className="font-medium">{b.pet_name}</TableCell>
                    <TableCell>{b.ward_no}</TableCell>
                    <TableCell>{b.start_date.slice(0, 10)}</TableCell>
                    <TableCell>
                      {b.end_date ? (
                        b.end_date.slice(0, 10)
                      ) : (
                        <Badge variant="default">进行中</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => navigate(`/boarding/${b.boarding_id}`)}
                        >
                          <Eye className="size-3.5" />
                          查看
                        </Button>
                        {!b.end_date && isAdmin && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setEndTarget({
                                id: b.boarding_id,
                                name: b.pet_name,
                              })
                            }
                          >
                            <LogOut className="size-3.5" />
                            结束
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddBoardingDialog open={showAdd} onOpenChange={setShowAdd} />

      <ConfirmDialog
        open={!!endTarget}
        onOpenChange={(v) => {
          if (!v) setEndTarget(null);
        }}
        title="结束寄养"
        description={
          endTarget
            ? `确认结束「${endTarget.name}」的寄养吗？`
            : ""
        }
        confirmLabel="确认结束"
        variant="destructive"
        onConfirm={handleEnd}
        loading={endBoarding.isPending}
      />
    </div>
  );
}
