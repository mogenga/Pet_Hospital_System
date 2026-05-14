import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  "待接诊": "bg-yellow-100 text-yellow-800",
  "接诊中": "bg-blue-100 text-blue-800",
  "待收费": "bg-purple-100 text-purple-800",
  "已完成": "bg-green-100 text-green-800",
  "已取消": "bg-gray-100 text-gray-800",
  "未结清": "bg-red-100 text-red-800",
  "已结清": "bg-green-100 text-green-800",
  "住院中": "bg-blue-100 text-blue-800",
  "已出院": "bg-green-100 text-green-800",
  "空闲": "bg-green-100 text-green-800",
  "占用": "bg-orange-100 text-orange-800",
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusColors[status] || "bg-gray-100 text-gray-800",
        className
      )}
    >
      {status}
    </span>
  );
}
