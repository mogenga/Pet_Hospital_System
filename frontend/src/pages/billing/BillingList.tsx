import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Eye } from "lucide-react";
import { useBills } from "@/hooks/useApiHooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusBadge from "@/components/common/StatusBadge";

type FilterTab = "all" | "未结清" | "已结清";

export default function BillingList() {
  const navigate = useNavigate();
  const { data: bills, isLoading } = useBills();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = useMemo(() => {
    if (!bills) return [];
    if (activeTab === "all") return bills;
    return bills.filter((b) => b.status === activeTab);
  }, [bills, activeTab]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            收费管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as FilterTab)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="未结清">未结清</TabsTrigger>
              <TabsTrigger value="已结清">已结清</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <Skeleton key={j} className="h-5 flex-1" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Receipt className="size-10 mb-2 opacity-30" />
                  <p className="text-sm">暂无账单数据</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账单ID</TableHead>
                      <TableHead>宠物名称</TableHead>
                      <TableHead>客户名称</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>总金额</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((b) => (
                      <TableRow key={b.bill_id}>
                        <TableCell className="text-muted-foreground">
                          #{b.bill_id}
                        </TableCell>
                        <TableCell>{b.pet_name || "-"}</TableCell>
                        <TableCell>{b.customer_name || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={b.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {b.created_at.slice(0, 16)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {Number(b.total_amount).toFixed(2)} 元
                        </TableCell>
                        <TableCell>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => navigate(`/billing/${b.bill_id}`)}
                          >
                            <Eye className="size-3.5" />
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
