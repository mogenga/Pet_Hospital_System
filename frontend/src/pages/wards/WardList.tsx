import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useWards,
  useCreateWard,
  useUpdateWard,
  useDeleteWard,
} from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { WardOut, WardCreate } from "@/types";

export default function WardList() {
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const { data: wards, isLoading, isError } = useWards();
  const createMutation = useCreateWard();
  const updateMutation = useUpdateWard();
  const deleteMutation = useDeleteWard();

  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    ward?: WardOut;
  }>({ open: false, mode: "create" });

  const [formData, setFormData] = useState({
    ward_no: "",
    type: "",
    daily_rate: "",
  });

  const [deleteTarget, setDeleteTarget] = useState<WardOut | null>(null);

  const openCreate = () => {
    setFormData({ ward_no: "", type: "", daily_rate: "" });
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (ward: WardOut) => {
    setFormData({
      ward_no: ward.ward_no,
      type: ward.type,
      daily_rate: ward.daily_rate,
    });
    setDialog({ open: true, mode: "edit", ward });
  };

  const closeDialog = () => setDialog((prev) => ({ ...prev, open: false }));

  const handleSubmit = () => {
    if (dialog.mode === "create") {
      const data: WardCreate = {
        ward_no: formData.ward_no.trim(),
        type: formData.type,
        daily_rate: parseFloat(formData.daily_rate),
      };
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success("新增笼位成功");
          closeDialog();
        },
      });
    } else if (dialog.ward) {
      updateMutation.mutate(
        {
          id: dialog.ward.ward_id,
          data: {
            ward_no: formData.ward_no.trim(),
            type: formData.type || null,
            daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
          },
        },
        {
          onSuccess: () => {
            toast.success("编辑笼位成功");
            closeDialog();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.ward_id, {
      onSuccess: () => {
        toast.success("删除笼位成功");
        setDeleteTarget(null);
      },
    });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">笼位管理</h1>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            新增笼位
          </Button>
        )}
      </div>

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
      ) : !wards || wards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无笼位数据
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>笼位编号</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>日费率</TableHead>
              <TableHead>状态</TableHead>
              {isAdmin && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {wards.map((w) => (
              <TableRow key={w.ward_id}>
                <TableCell className="font-medium">{w.ward_no}</TableCell>
                <TableCell>
                  <Badge variant={w.type === "病房" ? "default" : "secondary"}>
                    <Home className="mr-1 size-3" />
                    {w.type}
                  </Badge>
                </TableCell>
                <TableCell>¥{Number(w.daily_rate).toFixed(2)}/天</TableCell>
                <TableCell>
                  <Badge variant={w.status === "空闲" ? "outline" : "default"}>
                    {w.status}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(w)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(w)}
                        disabled={w.status !== "空闲"}
                      >
                        <Trash2 className={`size-4 ${w.status !== "空闲" ? "text-muted-foreground" : "text-destructive"}`} />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 底部统计 */}
      {wards && (
        <p className="text-sm text-muted-foreground">
          共 {wards.length} 个笼位
          {wards.filter((w) => w.status === "空闲").length !== wards.length
            ? `，其中 ${wards.filter((w) => w.status === "空闲").length} 个空闲`
            : ""}
        </p>
      )}

      {/* 新增/编辑弹窗 */}
      <Dialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialog((prev) => ({ ...prev, open }));
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "新增笼位" : "编辑笼位"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ward-no">笼位编号</Label>
              <Input
                id="ward-no"
                value={formData.ward_no}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, ward_no: e.target.value }))
                }
                placeholder="如：D01"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ward-type">类型</Label>
              <Select
                value={formData.type}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, type: v ?? "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="病房">病房</SelectItem>
                  <SelectItem value="寄养笼">寄养笼</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ward-rate">日费率（元/天）</Label>
              <Input
                id="ward-rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.daily_rate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    daily_rate: e.target.value,
                  }))
                }
                placeholder="如：120.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.ward_no.trim() ||
                !formData.type ||
                !formData.daily_rate ||
                isMutating
              }
            >
              {isMutating ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="确认删除"
        description={`确定要删除笼位「${deleteTarget?.ward_no}」吗？此操作不可撤销。`}
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
