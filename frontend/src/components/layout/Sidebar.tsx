import { NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, Users, Stethoscope, Pill, Receipt,
  Building2, Dog, UserCog, ChevronLeft, ChevronRight,
  Cat, PawPrint,
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
  { title: "客户管理", path: "/customers", icon: Users, roles: ["管理员", "医生", "护士"] },
  { title: "就诊管理", path: "/consultation", icon: Stethoscope, roles: ["管理员", "医生", "护士"] },
  { title: "药品库存", path: "/pharmacy", icon: Pill, roles: ["管理员", "医生", "护士"] },
  { title: "收费管理", path: "/billing", icon: Receipt, roles: ["管理员", "医生", "护士"] },
  { title: "住院管理", path: "/hospitalization", icon: Building2, roles: ["管理员", "医生", "护士"] },
  { title: "笼位管理", path: "/wards", icon: Home, roles: ["管理员"] },
  { title: "寄养管理", path: "/boarding", icon: Dog, roles: ["管理员", "医生", "护士"] },
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
        "flex flex-col bg-sidebar text-sidebar-foreground shadow-xl shadow-orange-950/20 transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-orange-900/30">
              <Cat className="h-5 w-5" />
              <PawPrint className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-100 p-0.5 text-primary" />
            </span>
            <div>
              <div className="text-lg font-semibold tracking-wide">宠物医院</div>
              <div className="text-xs text-sidebar-foreground/55">暖心诊疗与住院护理</div>
            </div>
          </div>
        )}
        {collapsed && <Cat className="h-6 w-6 text-primary" />}
      </div>

      <nav className="flex-1 space-y-1.5 p-2.5">
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
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm shadow-orange-950/20"
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
