import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PetMascots } from "@/components/common/PetMascots";
import {
  Cat,
  Dog,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Lock,
  PawPrint,
  User,
} from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      if (e && typeof e === "object" && "response" in e) {
        // 错误已由拦截器处理
      } else {
        toast.error("操作失败，请检查网络连接");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50 via-white to-amber-50/60 px-5 py-8">
      {/* 背景装饰 */}
      <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-orange-200/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-200/15 blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-orange-300/10 blur-3xl" />

      {/* 背景猫狗剪影 */}
      <motion.div
        className="pointer-events-none absolute left-[8%] top-[20%] text-orange-200/40 lg:block hidden"
        animate={{ y: [0, -12, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cat className="h-24 w-24 stroke-[1.2]" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute bottom-[16%] right-[10%] text-orange-200/40 lg:block hidden"
        animate={{ y: [0, 10, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Dog className="h-28 w-28 stroke-[1.2]" />
      </motion.div>

      {/* 浮动爪印 */}
      {[
        { r: "15%", t: "25%", d: 7, s: "h-10 w-10" },
        { r: "20%", t: "55%", d: 8.5, s: "h-6 w-6" },
        { r: "78%", t: "30%", d: 6.8, s: "h-8 w-8" },
        { r: "75%", t: "65%", d: 9.2, s: "h-5 w-5" },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute text-orange-300/25"
          style={{ right: p.r, top: p.t }}
          animate={{ y: [0, -14, 0], rotate: [0, 15, 0], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: p.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
        >
          <PawPrint className={`${p.s} stroke-[1.4]`} />
        </motion.div>
      ))}

      {/* 主体 */}
      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* 顶部标签 */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-white/80 px-4 py-1.5 text-sm font-medium text-orange-600 shadow-sm backdrop-blur">
          <HeartPulse className="h-4 w-4" />
          Pet Hospital System
        </div>

        {/* 吉祥物 */}
        <PetMascots className="mb-4 scale-90" />

        {/* 登录卡片 */}
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
              {/* 用户名 */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11 pl-10 text-sm transition-shadow focus-visible:ring-orange-400/40"
                />
              </div>

              {/* 密码 */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pl-10 pr-10 text-sm transition-shadow focus-visible:ring-orange-400/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="h-11 w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200/50 transition-all hover:from-orange-600 hover:to-amber-600 hover:shadow-lg hover:shadow-orange-200/60"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中...
                  </>
                ) : (
                  "登 录"
                )}
              </Button>
            </form>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
