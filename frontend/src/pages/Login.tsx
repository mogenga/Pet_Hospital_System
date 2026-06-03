import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PetMascots } from "@/components/common/PetMascots";
import { Cat, Dog, HeartPulse, PawPrint } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 pet-pattern">
      <div className="absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-orange-200/25 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="pointer-events-none absolute left-[10%] top-[18%] hidden text-orange-200/45 lg:block">
        <Cat className="h-28 w-28 stroke-[1.2]" />
      </div>
      <div className="pointer-events-none absolute bottom-[14%] right-[12%] hidden text-orange-200/45 lg:block">
        <Dog className="h-32 w-32 stroke-[1.2]" />
      </div>
      <div className="pointer-events-none absolute right-[24%] top-[16%] hidden text-orange-300/30 md:block">
        <PawPrint className="h-16 w-16 rotate-12 stroke-[1.3]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/70 px-3 py-1.5 text-sm font-medium text-primary shadow-sm shadow-orange-100/60 backdrop-blur">
          <HeartPulse className="h-4 w-4" />
          Pet Hospital System
        </div>

        <PetMascots className="mb-3 scale-90" />

        <Card className="warm-card w-full rounded-2xl py-6 shadow-xl shadow-orange-200/25">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-primary ring-1 ring-orange-200">
              <PawPrint className="h-6 w-6 stroke-[1.8]" />
            </div>
            <CardTitle className="text-2xl font-bold text-orange-950">宠物医院管理系统</CardTitle>
            <CardDescription>请输入账号和密码登录</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="h-10 w-full shadow-sm shadow-orange-200" disabled={loading}>
                {loading ? "登录中..." : "登 录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
