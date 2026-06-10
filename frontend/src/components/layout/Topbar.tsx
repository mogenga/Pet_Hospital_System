import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { LogOut, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "仪表盘",
  "/customers": "客户管理",
  "/consultation": "就诊管理",
  "/pharmacy": "药品库存",
  "/billing": "收费管理",
  "/hospitalization": "住院管理",
  "/boarding": "寄养管理",
  "/wards": "笼位管理",
  "/accounts": "账号管理",
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    toast.success("已退出登录");
    navigate("/login", { replace: true });
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    for (const [key, label] of Object.entries(breadcrumbMap)) {
      if (path.startsWith(key)) return label;
    }
    return "";
  };

  const initials = user?.name?.slice(0, 2) ?? "?";

  return (
    <header className="flex h-16 items-center justify-between border-b border-orange-100/80 bg-card/85 px-6 shadow-sm shadow-orange-100/60 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-primary">
          <PawPrint className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">{getBreadcrumb()}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs shadow-sm shadow-orange-200">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{user?.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="text-sm">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
