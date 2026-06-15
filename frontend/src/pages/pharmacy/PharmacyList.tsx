import { useState } from "react";
import { toast } from "sonner";
import { Pill, Warehouse, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  useMedicines,
  useCreateMedicine,
  useBatches,
  useCreateBatch,
  useMedicineStats,
} from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ---- 新增药品表单 ----
// 药品分类（固定选项）
const MEDICINE_CATEGORIES = [
  "抗生素",
  "消炎药",
  "疫苗",
  "驱虫药",
  "外用药",
  "营养补充",
  "其他",
];

function AddMedicineDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMedicine = useCreateMedicine();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [category, setCategory] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !unit.trim() || !unitPrice || !category.trim()) return;
    try {
      await createMedicine.mutateAsync({
        name: name.trim(),
        unit: unit.trim(),
        unit_price: parseFloat(unitPrice),
        category: category.trim(),
      });
      toast.success("药品新增成功");
      setName("");
      setUnit("");
      setUnitPrice("");
      setCategory("");
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
          <DialogTitle>新增药品</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-name">药品名称</Label>
            <Input
              id="med-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入药品名称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-unit">单位</Label>
            <Input
              id="med-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="如：盒、瓶、片"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-price">单价</Label>
            <Input
              id="med-price"
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-category">分类</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择分类" />
              </SelectTrigger>
              <SelectContent>
                {MEDICINE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={createMedicine.isPending}
          >
            {createMedicine.isPending && (
              <Loader2 className="animate-spin" />
            )}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- 入库表单 ----
function AddBatchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: medicines, isLoading: medsLoading } = useMedicines();
  const createBatch = useCreateBatch();
  const [medicineId, setMedicineId] = useState("");

  // 计算选中药品的名称（避免 SelectValue 回退显示数字 ID）
  const selectedMedicineName = (medicines || []).find(
    (m) => String(m.medicine_id) === medicineId
  )?.name;
  const [inDate, setInDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [costPrice, setCostPrice] = useState("");

  const handleSubmit = async () => {
    if (!medicineId || !inDate || !expireDate || !stockQty || !costPrice) return;
    try {
      await createBatch.mutateAsync({
        medicine_id: parseInt(medicineId),
        in_date: inDate,
        expire_date: expireDate,
        stock_qty: parseInt(stockQty),
        cost_price: parseFloat(costPrice),
      });
      toast.success("入库成功");
      setMedicineId("");
      setInDate("");
      setExpireDate("");
      setStockQty("");
      setCostPrice("");
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
          <DialogTitle>药品入库</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>药品</Label>
            <Select value={medicineId} onValueChange={(v) => setMedicineId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择药品">
                  {selectedMedicineName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {medsLoading ? (
                  <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                    加载中...
                  </div>
                ) : (
                  (medicines || []).map((m) => (
                    <SelectItem key={m.medicine_id} value={String(m.medicine_id)}>
                      {m.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-in-date">入库日期</Label>
            <Input
              id="batch-in-date"
              type="date"
              value={inDate}
              onChange={(e) => setInDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-expire-date">过期日期</Label>
            <Input
              id="batch-expire-date"
              type="date"
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-qty">库存数量</Label>
            <Input
              id="batch-qty"
              type="number"
              min="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-cost">成本价</Label>
            <Input
              id="batch-cost"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={createBatch.isPending}
          >
            {createBatch.isPending && (
              <Loader2 className="animate-spin" />
            )}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Loading skeleton for tables ----
function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
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

export default function PharmacyList() {
  const isAdmin = useAuthStore((s) => s.user?.role === "管理员");
  const { data: medicines, isLoading: medsLoading } = useMedicines();
  const { data: medStats } = useMedicineStats();
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);

  // 分类筛选
  const [categoryFilter, setCategoryFilter] = useState("全部");

  // 低库存预警 toggle
  const [lowStock, setLowStock] = useState(false);
  const { data: batches, isLoading: batchesLoading } = useBatches(
    lowStock ? 10 : undefined
  );

  // 按分类筛选
  const filteredMedicines =
    categoryFilter === "全部"
      ? medicines
      : (medicines || []).filter((m) => m.category === categoryFilter);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ======== 分类统计 ======== */}
      {medStats && medStats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {medStats.map((s) => (
            <Card
              key={s.category}
              className="warm-card flex-1 min-w-[120px] cursor-pointer px-4 py-3 transition-colors hover:bg-orange-50"
              onClick={() =>
                setCategoryFilter(
                  categoryFilter === s.category ? "全部" : s.category
                )
              }
            >
              <div className="text-xs text-muted-foreground">
                {s.category}
              </div>
              <div
                className={`text-xl font-bold ${categoryFilter === s.category ? "text-primary" : ""}`}
              >
                {s.count}
              </div>
              <div className="text-xs text-muted-foreground">
                成本 {Number(s.total_cost).toFixed(0)} 元
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ======== 药品列表 ======== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pill className="size-5" />
              药品列表{categoryFilter !== "全部" ? ` · ${categoryFilter}` : ""}
            </CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowAddMedicine(true)}>
                <Plus className="size-4" />
                新增药品
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {medsLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : !medicines?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Pill className="size-10 mb-2 opacity-30" />
              <p className="text-sm">
                {categoryFilter !== "全部"
                  ? `暂无"${categoryFilter}"分类的药品`
                  : "暂无药品数据"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>药品名称</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>分类</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicines.map((m) => (
                  <TableRow key={m.medicine_id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.unit}</TableCell>
                    <TableCell>{Number(m.unit_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.category}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ======== 批次库存 ======== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-5" />
              批次库存
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={lowStock ? "default" : "outline"}
                onClick={() => setLowStock(!lowStock)}
              >
                <AlertTriangle className="size-4" />
                低库存预警
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddBatch(true)}>
                  <Plus className="size-4" />
                  入库
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : !batches?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Warehouse className="size-10 mb-2 opacity-30" />
              <p className="text-sm">
                {lowStock ? "无低库存批次" : "暂无批次数据"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次ID</TableHead>
                  <TableHead>药品名</TableHead>
                  <TableHead>入库日期</TableHead>
                  <TableHead>过期日期</TableHead>
                  <TableHead>库存量</TableHead>
                  <TableHead>成本价</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.batch_id}>
                    <TableCell className="text-muted-foreground">
                      #{b.batch_id}
                    </TableCell>
                    <TableCell className="font-medium">{b.medicine_name}</TableCell>
                    <TableCell>{b.in_date.slice(0, 10)}</TableCell>
                    <TableCell>{b.expire_date.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={b.stock_qty < 10 ? "destructive" : "secondary"}
                      >
                        {b.stock_qty}
                      </Badge>
                    </TableCell>
                    <TableCell>{Number(b.cost_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 弹窗 */}
      <AddMedicineDialog
        open={showAddMedicine}
        onOpenChange={setShowAddMedicine}
      />
      <AddBatchDialog
        open={showAddBatch}
        onOpenChange={setShowAddBatch}
      />
    </div>
  );
}
