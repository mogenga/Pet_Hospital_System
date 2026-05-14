import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CustomerList from "@/pages/customers/CustomerList";
import CustomerDetail from "@/pages/customers/CustomerDetail";
import ConsultationList from "@/pages/consultation/ConsultationList";
import ConsultationDetail from "@/pages/consultation/ConsultationDetail";
import PharmacyList from "@/pages/pharmacy/PharmacyList";
import BillingList from "@/pages/billing/BillingList";
import BillingDetail from "@/pages/billing/BillingDetail";
import HospList from "@/pages/hospitalization/HospList";
import HospDetail from "@/pages/hospitalization/HospDetail";
import BoardingList from "@/pages/boarding/BoardingList";
import BoardingDetail from "@/pages/boarding/BoardingDetail";
import AccountList from "@/pages/accounts/AccountList";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "customers", element: <CustomerList /> },
      { path: "customers/:id", element: <CustomerDetail /> },
      { path: "consultation", element: <ConsultationList /> },
      { path: "consultation/:id", element: <ConsultationDetail /> },
      { path: "pharmacy", element: <PharmacyList /> },
      { path: "billing", element: <BillingList /> },
      { path: "billing/:id", element: <BillingDetail /> },
      { path: "hospitalization", element: <HospList /> },
      { path: "hospitalization/:id", element: <HospDetail /> },
      { path: "boarding", element: <BoardingList /> },
      { path: "boarding/:id", element: <BoardingDetail /> },
      {
        path: "accounts",
        element: (
          <ProtectedRoute allowedRoles={["管理员"]}>
            <AccountList />
          </ProtectedRoute>
        ),
      },
      { path: "403", element: <div className="flex h-full items-center justify-center"><p className="text-xl text-muted-foreground">权限不足</p></div> },
      { path: "*", element: <div className="flex h-full items-center justify-center"><p className="text-xl text-muted-foreground">页面不存在</p></div> },
    ],
  },
]);
