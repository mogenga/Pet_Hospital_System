import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
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
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { CustomerOut, CustomerCreate } from "@/types";

export default function CustomerList() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const { data: customers, isLoading, isError } = useCustomers();
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    customer?: CustomerOut;
  }>({ open: false, mode: "create" });

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [deleteTarget, setDeleteTarget] = useState<CustomerOut | null>(null);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  const openCreate = () => {
    setFormData({ name: "", phone: "", address: "" });
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (customer: CustomerOut) => {
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || "",
    });
    setDialog({ open: true, mode: "edit", customer });
  };

  const closeDialog = () => setDialog((prev) => ({ ...prev, open: false }));

  const handleSubmit = () => {
    if (dialog.mode === "create") {
      const data: CustomerCreate = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || null,
      };
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success("新增客户成功");
          closeDialog();
        },
      });
    } else if (dialog.customer) {
      updateMutation.mutate(
        {
          id: dialog.customer.customer_id,
          data: {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim() || null,
          },
        },
        {
          onSuccess: () => {
            toast.success("更新客户成功");
            closeDialog();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.customer_id, {
      onSuccess: () => {
        toast.success("删除客户成功");
        setDeleteTarget(null);
      },
    });
  };

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">客户管理</h1>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            新增客户
          </Button>
        )}
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索姓名或手机号..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
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
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? "未找到匹配的客户" : "暂无客户数据"}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>地址</TableHead>
              <TableHead>宠物数量</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow
                key={c.customer_id}
                className="cursor-pointer"
                onClick={() => navigate(`/customers/${c.customer_id}`)}
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.address || "-"}</TableCell>
                <TableCell>{c.pets.length}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        navigate(`/customers/${c.customer_id}`)
                      }
                    >
                      <Eye className="size-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 底部统计 */}
      {customers && (
        <p className="text-sm text-muted-foreground">
          共 {customers.length} 位客户
          {search && filtered.length !== customers.length
            ? `，筛选出 ${filtered.length} 条`
            : ""}
        </p>
      )}

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialog.open} onOpenChange={(open) => {
        if (!open) closeDialog();
        else setDialog((prev) => ({ ...prev, open }));
      }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "新增客户" : "编辑客户"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cust-name">姓名</Label>
              <Input
                id="cust-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="请输入姓名"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cust-phone">手机号</Label>
              <Input
                id="cust-phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="请输入手机号"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cust-address">地址</Label>
              <Input
                id="cust-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="请输入地址（选填）"
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
                !formData.name.trim() || !formData.phone.trim() || isMutating
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
        description={`确定要删除客户「${deleteTarget?.name}」吗？此操作不可撤销。`}
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
