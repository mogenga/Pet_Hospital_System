import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  "/accounts": "账号管理",
};

export default function Topbar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const getBreadcrumb = () => {
    const path = location.pathname;
    for (const [key, label] of Object.entries(breadcrumbMap)) {
      if (path.startsWith(key)) return label;
    }
    return "";
  };

  const initials = user?.name?.slice(0, 2) ?? "?";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <span className="text-sm text-muted-foreground">{getBreadcrumb()}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{user?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="text-sm">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
