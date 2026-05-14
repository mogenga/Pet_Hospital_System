import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Plus, Shield, Trash2, ToggleLeft } from "lucide-react";
import {
  useAccounts,
  useCreateAccount,
  useToggleAccount,
  useDeleteAccount,
  useEmployees,
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { AccountOut } from "@/types";

export default function AccountList() {
  const { data: accounts, isLoading, isError } = useAccounts();
  const { data: employees } = useEmployees();
  const createMutation = useCreateAccount();
  const toggleMutation = useToggleAccount();
  const deleteMutation = useDeleteAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: "",
    username: "",
    password: "",
  });

  const [deleteTarget, setDeleteTarget] = useState<AccountOut | null>(null);

  const openCreate = () => {
    setFormData({ employee_id: "", username: "", password: "" });
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const handleCreate = () => {
    createMutation.mutate(
      {
        employee_id: parseInt(formData.employee_id),
        username: formData.username.trim(),
        password: formData.password,
      },
      {
        onSuccess: () => {
          toast.success("新增账号成功");
          closeDialog();
        },
      }
    );
  };

  const handleToggle = (account: AccountOut) => {
    toggleMutation.mutate(
      { accountId: account.account_id, isActive: !account.is_active },
      {
        onSuccess: () =>
          toast.success(account.is_active ? "账号已停用" : "账号已启用"),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.account_id, {
      onSuccess: () => {
        toast.success("删除账号成功");
        setDeleteTarget(null);
      },
    });
  };

  const canSubmit =
    formData.employee_id &&
    formData.username.trim() &&
    formData.password;

  return (
    <div className="flex flex-col gap-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <UserCog className="size-5" />
          账号管理
        </h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          新增账号
        </Button>
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
      ) : !accounts?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <UserCog className="size-10 mb-2 opacity-30" />
          <p className="text-sm">暂无账号</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账号ID</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead>员工ID</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <Shield className="size-3.5" />
                  状态
                </span>
              </TableHead>
              <TableHead>最后登录时间</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.account_id}>
                <TableCell className="text-muted-foreground">
                  #{a.account_id}
                </TableCell>
                <TableCell className="font-medium">{a.username}</TableCell>
                <TableCell>{a.employee_id}</TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "destructive"}>
                    {a.is_active ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.last_login ? a.last_login.slice(0, 16) : "从未登录"}
                </TableCell>
                <TableCell>{a.created_at.slice(0, 10)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(a)}
                      disabled={toggleMutation.isPending}
                    >
                      <ToggleLeft className="size-4" />
                      {a.is_active ? "停用" : "启用"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 底部统计 */}
      {accounts && (
        <p className="text-sm text-muted-foreground">
          共 {accounts.length} 个账号
        </p>
      )}

      {/* 新增账号弹窗 */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>新增账号</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>员工</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, employee_id: v ?? "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {(employees || []).map((e) => (
                    <SelectItem
                      key={e.employee_id}
                      value={String(e.employee_id)}
                    >
                      {e.name}（{e.role}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-username">用户名</Label>
              <Input
                id="acc-username"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="请输入用户名"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-password">密码</Label>
              <Input
                id="acc-password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="请输入密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? "保存中..." : "保存"}
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
        description={
          deleteTarget
            ? `确定要删除账号「${deleteTarget.username}」吗？此操作不可撤销。`
            : ""
        }
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
