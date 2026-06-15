import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/api/client";
import type {
  CustomerOut, CustomerCreate, CustomerUpdate,
  PetCreate, PetUpdate,
  MedicineOut, MedicineCreate, MedicineUpdate, MedicineCategoryStat, BatchOut, BatchCreate, BatchUpdate,
  VisitOut, VisitDetail, VisitCreate, DiagnosisCreate, PrescriptionCreate,
  CustomerVisitHistory,
  BillOut, BillDetail, BillItemCreate,
  WardOut, WardCreate, WardUpdate, HospListOut, HospDetail, AdmitCreate, NursingCreate,
  BoardingListOut, BoardingDetail, BoardingCreate, EndBoardingResponse,
  AccountOut, AccountCreate, EmployeeOut,
} from "@/types";

// ==================== 客户 ====================
export function useCustomers() {
  return useQuery<CustomerOut[]>({
    queryKey: ["customers"],
    queryFn: () => apiClient.get("/api/customers").then((r) => r.data),
    staleTime: 300000,
  });
}

export function useCustomer(id: number | undefined) {
  return useQuery<CustomerOut>({
    queryKey: ["customers", id],
    queryFn: () => apiClient.get(`/api/customers/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerCreate) =>
      apiClient.post("/api/customers", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CustomerUpdate }) =>
      apiClient.put(`/api/customers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCreatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: number; data: PetCreate }) =>
      apiClient.post(`/api/customers/${customerId}/pets`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdatePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, petId, data }: { customerId: number; petId: number; data: PetUpdate }) =>
      apiClient.put(`/api/customers/${customerId}/pets/${petId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeletePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, petId }: { customerId: number; petId: number }) =>
      apiClient.delete(`/api/customers/${customerId}/pets/${petId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCustomerHistory(id: number | undefined) {
  return useQuery<CustomerVisitHistory[]>({
    queryKey: ["customers", id, "history"],
    queryFn: () => apiClient.get(`/api/customers/${id}/history`).then((r) => r.data),
    enabled: !!id,
  });
}

// ==================== 药品库存 ====================
export function useMedicines() {
  return useQuery<MedicineOut[]>({
    queryKey: ["medicines"],
    queryFn: () => apiClient.get("/api/pharmacy/medicines").then((r) => r.data),
    staleTime: 600000,
  });
}

export function useCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MedicineCreate) =>
      apiClient.post("/api/pharmacy/medicines", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicines"] }),
  });
}

export function useUpdateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MedicineUpdate }) =>
      apiClient
        .put(`/api/pharmacy/medicines/${id}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicines"] }),
  });
}

export function useMedicineStats() {
  return useQuery<MedicineCategoryStat[]>({
    queryKey: ["medicineStats"],
    queryFn: () =>
      apiClient.get("/api/pharmacy/medicines/stats").then((r) => r.data),
    staleTime: 300000,
  });
}

export function useBatches(stockLow?: number) {
  return useQuery<BatchOut[]>({
    queryKey: ["batches", stockLow],
    queryFn: () => {
      const params = stockLow != null ? `?stock_qty_lt=${stockLow}` : "";
      return apiClient.get(`/api/pharmacy/batches${params}`).then((r) => r.data);
    },
    staleTime: 300000,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchCreate) =>
      apiClient.post("/api/pharmacy/batches", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["medicineStats"] });
    },
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BatchUpdate }) =>
      apiClient
        .put(`/api/pharmacy/batches/${id}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["medicineStats"] });
    },
  });
}

// ==================== 就诊 ====================
export function useVisits(status?: string) {
  return useQuery<VisitOut[]>({
    queryKey: ["visits", status],
    queryFn: () => {
      const params = status ? `?status=${status}` : "";
      return apiClient.get(`/api/consultation/visits${params}`).then((r) => r.data);
    },
    staleTime: 60000,
  });
}

export function useVisitDetail(id: number | undefined) {
  return useQuery<VisitDetail>({
    queryKey: ["visits", id],
    queryFn: () => apiClient.get(`/api/consultation/visits/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VisitCreate) =>
      apiClient.post("/api/consultation/visits", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useAcceptVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitId: number) =>
      apiClient.put(`/api/consultation/visits/${visitId}/accept`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useCreateDiagnosis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, data }: { visitId: number; data: DiagnosisCreate }) =>
      apiClient.post(`/api/consultation/visits/${visitId}/diagnosis`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ diagnosisId, data }: { diagnosisId: number; data: PrescriptionCreate }) =>
      apiClient.post(`/api/consultation/diagnoses/${diagnosisId}/prescriptions`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useCancelVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitId: number) =>
      apiClient.delete(`/api/consultation/visits/${visitId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

export function useCompleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitId: number) =>
      apiClient.put(`/api/consultation/visits/${visitId}/complete`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });
}

// ==================== 账单 ====================
export function useBills() {
  return useQuery<BillOut[]>({
    queryKey: ["bills"],
    queryFn: () => apiClient.get("/api/billing/bills").then((r) => r.data),
    staleTime: 120000,
  });
}

export function useBillDetail(id: number | undefined) {
  return useQuery<BillDetail>({
    queryKey: ["bills", id],
    queryFn: () => apiClient.get(`/api/billing/bills/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAddBillItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, data }: { visitId: number; data: BillItemCreate }) =>
      apiClient.post(`/api/billing/visits/${visitId}/items`, data).then((r) => r.data),
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });
}

export function useSettleBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (billId: number) =>
      apiClient.post(`/api/billing/bills/${billId}/settle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
  });
}

// ==================== 住院 ====================
export function useWards() {
  return useQuery<WardOut[]>({
    queryKey: ["wards"],
    queryFn: () => apiClient.get("/api/wards").then((r) => r.data),
    staleTime: 300000,
  });
}

export function useCreateWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WardCreate) =>
      apiClient.post("/api/wards", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wards"] }),
  });
}

export function useUpdateWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WardUpdate }) =>
      apiClient.put(`/api/wards/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wards"] }),
  });
}

export function useDeleteWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/api/wards/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wards"] }),
  });
}

export function useHospitalizations(status?: string) {
  return useQuery<HospListOut[]>({
    queryKey: ["hospitalizations", status],
    queryFn: () => {
      const params = status ? `?status=${status}` : "";
      return apiClient.get(`/api/hospitalization${params}`).then((r) => r.data);
    },
    staleTime: 120000,
  });
}

export function useHospDetail(id: number | undefined) {
  return useQuery<HospDetail>({
    queryKey: ["hospitalizations", id],
    queryFn: () => apiClient.get(`/api/hospitalization/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAdmit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AdmitCreate) =>
      apiClient.post("/api/hospitalization", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitalizations"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
    },
  });
}

export function useAddNursing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hospId, data }: { hospId: number; data: NursingCreate }) =>
      apiClient.post(`/api/hospitalization/${hospId}/nursing`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hospitalizations"] }),
  });
}

export function useDischarge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hospId: number) =>
      apiClient.put(`/api/hospitalization/${hospId}/discharge`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitalizations"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
    },
  });
}

// ==================== 寄养 ====================
export function useBoardings() {
  return useQuery<BoardingListOut[]>({
    queryKey: ["boardings"],
    queryFn: () => apiClient.get("/api/boarding").then((r) => r.data),
    staleTime: 300000,
  });
}

export function useBoardingDetail(id: number | undefined) {
  return useQuery<BoardingDetail>({
    queryKey: ["boardings", id],
    queryFn: () => apiClient.get(`/api/boarding/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateBoarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BoardingCreate) =>
      apiClient.post("/api/boarding", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boardings"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
    },
  });
}

export function useEndBoarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boardingId: number): Promise<EndBoardingResponse> =>
      apiClient.put(`/api/boarding/${boardingId}/end`).then((r) => r.data),
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ["boardings"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
    },
  });
}

// ==================== MinIO 文件上传 ====================
export function useMinioUploadUrl() {
  return useMutation({
    mutationFn: ({ fileKey, contentType }: { fileKey: string; contentType?: string }) =>
      apiClient.post("/api/minio/upload-url", { file_key: fileKey, content_type: contentType || "image/jpeg" }).then((r) => r.data as { upload_url: string; file_key: string }),
  });
}

export function useMinioDownloadUrl(fileKey: string | null | undefined) {
  return useQuery<{ url: string; file_key: string }>({
    queryKey: ["minio-download", fileKey],
    queryFn: () => apiClient.get("/api/minio/download-url", { params: { file_key: fileKey } }).then((r) => r.data),
    enabled: !!fileKey,
    staleTime: 300000, // 5 分钟，presigned URL 有效期内不重复请求
  });
}

// ==================== 员工 ====================
export function useEmployees() {
  return useQuery<EmployeeOut[]>({
    queryKey: ["employees"],
    queryFn: () => apiClient.get("/api/employees").then((r) => r.data),
    staleTime: 600000,
  });
}

// ==================== 账号管理 ====================
export function useAccounts() {
  return useQuery<AccountOut[]>({
    queryKey: ["accounts"],
    queryFn: () => apiClient.get("/api/accounts").then((r) => r.data),
    staleTime: 300000,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AccountCreate) =>
      apiClient.post("/api/accounts", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useToggleAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, isActive }: { accountId: number; isActive: boolean }) =>
      apiClient.put(`/api/accounts/${accountId}`, { is_active: isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) =>
      apiClient.delete(`/api/accounts/${accountId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
