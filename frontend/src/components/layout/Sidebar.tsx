import { NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, Users, Stethoscope, Pill, Receipt,
  Building2, Dog, UserCog, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MenuItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const menuItems: MenuItem[] = [
  { title: "仪表盘", path: "/dashboard", icon: LayoutDashboard, roles: ["管理员", "医生", "护士"] },
  { title: "客户管理", path: "/customers", icon: Users, roles: ["管理员", "医生"] },
  { title: "就诊管理", path: "/consultation", icon: Stethoscope, roles: ["管理员", "医生"] },
  { title: "药品库存", path: "/pharmacy", icon: Pill, roles: ["管理员", "医生"] },
  { title: "收费管理", path: "/billing", icon: Receipt, roles: ["管理员", "医生"] },
  { title: "住院管理", path: "/hospitalization", icon: Building2, roles: ["管理员", "医生", "护士"] },
  { title: "寄养管理", path: "/boarding", icon: Dog, roles: ["管理员", "医生"] },
  { title: "账号管理", path: "/accounts", icon: UserCog, roles: ["管理员"] },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const visibleItems = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-14 items-center justify-center border-b border-sidebar-border px-3">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-wide">宠物医院</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path
            || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
