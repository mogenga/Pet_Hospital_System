import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Plus, Shield, Trash2, ToggleLeft } from "lucide-react";
import {
  useAccounts,
  useCreateAccount,
  useToggleAccount,
  useDeleteAccount,
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
  const createMutation = useCreateAccount();
  const toggleMutation = useToggleAccount();
  const deleteMutation = useDeleteAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "医生",
    password: "",
  });

  const [deleteTarget, setDeleteTarget] = useState<AccountOut | null>(null);

  const openCreate = () => {
    setFormData({ name: "", phone: "", role: "医生", password: "" });
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        password: formData.password || undefined,
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
    formData.name.trim() &&
    formData.phone.trim().length >= 6 &&
    formData.role;

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
              <TableHead>姓名</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>职位</TableHead>
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
                <TableCell className="font-medium">{a.employee_name}</TableCell>
                <TableCell>{a.employee_phone}</TableCell>
                <TableCell>{a.employee_role}</TableCell>
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
              <Label htmlFor="acc-name">姓名</Label>
              <Input
                id="acc-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="请输入员工姓名"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-phone">电话</Label>
              <Input
                id="acc-phone"
                value={formData.phone}
                onChange={(e) => {
                  const phone = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    phone,
                    // 自动填充密码为电话后6位
                    password: phone.length >= 6 ? phone.slice(-6) : "",
                  }));
                }}
                placeholder="请输入手机号"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>职位</Label>
              <Select
                value={formData.role}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, role: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择职位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="医生">医生</SelectItem>
                  <SelectItem value="护士">护士</SelectItem>
                  <SelectItem value="管理员">管理员</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="默认使用电话后6位"
              />
              <p className="text-xs text-muted-foreground">
                不填则自动使用电话后6位作为密码
              </p>
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
