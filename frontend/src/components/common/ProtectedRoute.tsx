import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);

  if (!isAuth()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !useAuthStore.getState().hasRole(...allowedRoles)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
