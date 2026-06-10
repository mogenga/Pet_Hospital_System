import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useCustomer,
  useCustomerHistory,
  useCreatePet,
  useUpdatePet,
  useDeletePet,
  useMinioDownloadUrl,
} from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import StatusBadge from "@/components/common/StatusBadge";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ImageUpload from "@/components/common/ImageUpload";
import type { PetOut, PetCreate } from "@/types";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const canUpload = useAuthStore((s) => {
    const role = s.user?.role;
    return role === "管理员" || role === "医生";
  });

  const { data: customer, isLoading, isError } = useCustomer(
    Number.isNaN(customerId) ? undefined : customerId
  );
  const { data: history } = useCustomerHistory(
    Number.isNaN(customerId) ? undefined : customerId
  );

  const createPetMutation = useCreatePet();
  const updatePetMutation = useUpdatePet();
  const deletePetMutation = useDeletePet();

  const [petDialog, setPetDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    pet?: PetOut;
  }>({ open: false, mode: "create" });

  const [petForm, setPetForm] = useState({
    name: "",
    species: "",
    breed: "",
    birth_date: "",
    photo_key: null as string | null,
  });

  const [deletePetTarget, setDeletePetTarget] = useState<PetOut | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const openCreatePet = () => {
    setPetForm({ name: "", species: "", breed: "", birth_date: "", photo_key: null });
    setPetDialog({ open: true, mode: "create" });
  };

  const openEditPet = (pet: PetOut) => {
    setPetForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || "",
      birth_date: pet.birth_date ? pet.birth_date.slice(0, 10) : "",
      photo_key: pet.photo_key,
    });
    setPetDialog({ open: true, mode: "edit", pet });
  };

  const closePetDialog = () =>
    setPetDialog((prev) => ({ ...prev, open: false }));

  const handlePetSubmit = () => {
    if (petDialog.mode === "create") {
      const data: PetCreate = {
        name: petForm.name.trim(),
        species: petForm.species.trim(),
        breed: petForm.breed.trim() || null,
        birth_date: petForm.birth_date || null,
        photo_key: petForm.photo_key,
      };
      createPetMutation.mutate(
        { customerId, data },
        {
          onSuccess: () => {
            toast.success("新增宠物成功");
            closePetDialog();
          },
        }
      );
    } else if (petDialog.pet) {
      updatePetMutation.mutate(
        {
          customerId,
          petId: petDialog.pet.pet_id,
          data: {
            name: petForm.name.trim(),
            species: petForm.species.trim(),
            breed: petForm.breed.trim() || null,
            birth_date: petForm.birth_date || null,
            photo_key: petForm.photo_key,
          },
        },
        {
          onSuccess: () => {
            toast.success("更新宠物成功");
            closePetDialog();
          },
        }
      );
    }
  };

  const handleDeletePet = () => {
    if (!deletePetTarget) return;
    deletePetMutation.mutate(
      {
        customerId,
        petId: deletePetTarget.pet_id,
      },
      {
        onSuccess: () => {
          toast.success("删除宠物成功");
          setDeletePetTarget(null);
        },
      }
    );
  };

  const isPetMutating =
    createPetMutation.isPending || updatePetMutation.isPending;

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // 错误或不存在
  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">
          客户不存在或加载失败
        </p>
        <Button variant="outline" onClick={() => navigate("/customers")}>
          返回客户列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        className="w-fit"
        onClick={() => navigate("/customers")}
      >
        <ArrowLeft className="size-4" />
        返回
      </Button>

      {/* 客户信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>客户信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground">姓名</p>
              <p className="text-sm font-medium">{customer.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">手机号</p>
              <p className="text-sm font-medium">{customer.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">地址</p>
              <p className="text-sm font-medium">
                {customer.address || "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 宠物列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>宠物列表</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={openCreatePet}>
              <Plus className="size-4" />
              新增宠物
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {customer.pets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无宠物
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>头像</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>物种</TableHead>
                  <TableHead>品种</TableHead>
                  <TableHead>出生日期</TableHead>
                  {isAdmin && <TableHead>操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.pets.map((pet) => (
                  <TableRow key={pet.pet_id}>
                    <TableCell>
                      <div
                        className={pet.photo_key ? "cursor-pointer" : ""}
                        onClick={() => pet.photo_key && setPreviewKey(pet.photo_key)}
                      >
                        <ImageUpload
                          fileKey={`pets/${pet.pet_id}/avatar.jpg`}
                          currentKey={pet.photo_key}
                          onSuccess={() => {}}
                          size="sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{pet.name}</TableCell>
                    <TableCell>{pet.species}</TableCell>
                    <TableCell>{pet.breed || "-"}</TableCell>
                    <TableCell>
                      {pet.birth_date
                        ? pet.birth_date.slice(0, 10)
                        : "-"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditPet(pet)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeletePetTarget(pet)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 就诊历史 */}
      <Card>
        <CardHeader>
          <CardTitle>就诊历史</CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无就诊记录
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>就诊编号</TableHead>
                  <TableHead>宠物编号</TableHead>
                  <TableHead>就诊时间</TableHead>
                  <TableHead>主诉</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>诊断结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.visit_id}>
                    <TableCell>{h.visit_id}</TableCell>
                    <TableCell>{h.pet_id}</TableCell>
                    <TableCell>
                      {h.visit_time ? h.visit_time.slice(0, 10) : "-"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {h.complaint || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={h.status} />
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {h.diagnosis?.diagnosis_result || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑宠物弹窗 */}
      <Dialog
        open={petDialog.open}
        onOpenChange={(open) => {
          if (!open) closePetDialog();
          else setPetDialog((prev) => ({ ...prev, open }));
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {petDialog.mode === "create" ? "新增宠物" : "编辑宠物"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pet-name">名称</Label>
              <Input
                id="pet-name"
                value={petForm.name}
                onChange={(e) =>
                  setPetForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="请输入宠物名称"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pet-species">物种</Label>
              <Input
                id="pet-species"
                value={petForm.species}
                onChange={(e) =>
                  setPetForm((prev) => ({ ...prev, species: e.target.value }))
                }
                placeholder="如：猫、狗"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pet-breed">品种</Label>
              <Input
                id="pet-breed"
                value={petForm.breed}
                onChange={(e) =>
                  setPetForm((prev) => ({ ...prev, breed: e.target.value }))
                }
                placeholder="请输入品种（选填）"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pet-birth">出生日期</Label>
              <Input
                id="pet-birth"
                type="date"
                value={petForm.birth_date}
                onChange={(e) =>
                  setPetForm((prev) => ({
                    ...prev,
                    birth_date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>宠物头像</Label>
              <ImageUpload
                fileKey={
                  petDialog.mode === "edit"
                    ? `pets/${petDialog.pet?.pet_id}/avatar.jpg`
                    : `pets/new_${Date.now()}.jpg`
                }
                currentKey={petForm.photo_key}
                onSuccess={(key) =>
                  setPetForm((prev) => ({ ...prev, photo_key: key }))
                }
                allowed={canUpload}
                size="md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePetDialog}>
              取消
            </Button>
            <Button
              onClick={handlePetSubmit}
              disabled={
                !petForm.name.trim() ||
                !petForm.species.trim() ||
                isPetMutating
              }
            >
              {isPetMutating ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除宠物确认 */}
      <ConfirmDialog
        open={!!deletePetTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePetTarget(null);
        }}
        title="确认删除"
        description={`确定要删除宠物「${deletePetTarget?.name}」吗？此操作不可撤销。`}
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={handleDeletePet}
        loading={deletePetMutation.isPending}
      />

      {/* 头像大图预览 */}
      <AvatarPreviewDialog
        photoKey={previewKey}
        onClose={() => setPreviewKey(null)}
      />
    </div>
  );
}

// 头像大图预览弹窗
function AvatarPreviewDialog({
  photoKey,
  onClose,
}: {
  photoKey: string | null;
  onClose: () => void;
}) {
  const { data } = useMinioDownloadUrl(photoKey);

  return (
    <Dialog open={!!photoKey} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>宠物头像</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center rounded-lg bg-muted/30 p-4">
          {data?.url ? (
            <img
              src={data.url}
              alt="宠物头像"
              className="max-h-96 max-w-full rounded-lg object-contain"
            />
          ) : (
            <Skeleton className="h-64 w-64" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" />
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
