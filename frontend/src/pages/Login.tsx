import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PetMascots } from "@/components/common/PetMascots";
import { PawPrint, ShieldCheck } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 pet-pattern">
      <div className="absolute left-8 top-8 hidden text-orange-200/70 md:block">
        <PawPrint className="h-14 w-14" />
      </div>
      <div className="absolute bottom-10 right-10 hidden text-amber-200/80 md:block">
        <PawPrint className="h-20 w-20 rotate-12" />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-primary shadow-sm ring-1 ring-orange-100">
            <ShieldCheck className="h-4 w-4" />
            宠物诊疗与住院管理
          </div>
          <h1 className="max-w-xl text-4xl font-bold leading-tight text-orange-950">
            让每一次接诊、护理和寄养都更有温度
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
            统一管理门诊、药房、收费、住院和寄养流程，保持清晰高效的日常工作台。
          </p>
          <PetMascots className="mt-8 scale-125 origin-left" />
        </section>

      <Card className="warm-card w-full max-w-sm justify-self-center rounded-2xl py-6">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-orange-200">
            <PawPrint className="h-7 w-7" />
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
