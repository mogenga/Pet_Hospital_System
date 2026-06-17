// 用户与认证
export interface User {
  account_id: number;
  username: string;
  name: string;
  role: "管理员" | "医生" | "护士";
  employee_id: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AccountOut {
  account_id: number;
  employee_id: number;
  username: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AccountCreate {
  employee_id: number;
  username: string;
  password: string;
}

// 客户与宠物
export interface CustomerOut {
  customer_id: number;
  name: string;
  phone: string;
  address: string | null;
  pets: PetOut[];
}

export interface PetOut {
  pet_id: number;
  customer_id: number;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  photo_key: string | null;
}

export interface CustomerCreate {
  name: string;
  phone: string;
  address?: string | null;
}

export interface CustomerUpdate {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface PetCreate {
  name: string;
  species: string;
  breed?: string | null;
  birth_date?: string | null;
  photo_key?: string | null;
}

export interface PetUpdate {
  name?: string | null;
  species?: string | null;
  breed?: string | null;
  birth_date?: string | null;
  photo_key?: string | null;
}

// 药品库存
export interface MedicineOut {
  medicine_id: number;
  name: string;
  unit: string;
  unit_price: number;
  category: string;
}

export interface MedicineCategoryStat {
  category: string;
  count: number;
  total_cost: string;
}

export interface MedicineUpdate {
  name?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  category?: string | null;
}

export interface MedicineCreate {
  name: string;
  unit: string;
  unit_price: number;
  category: string;
}

export interface BatchOut {
  batch_id: number;
  medicine_id: number;
  medicine_name: string;
  in_date: string;
  expire_date: string;
  stock_qty: number;
  cost_price: number;
}

export interface BatchUpdate {
  medicine_id?: number | null;
  in_date?: string | null;
  expire_date?: string | null;
  stock_qty?: number | null;
  cost_price?: number | null;
}

export interface BatchCreate {
  medicine_id: number;
  in_date: string;
  expire_date: string;
  stock_qty: number;
  cost_price: number;
}

// 就诊
export type VisitStatus = "待接诊" | "接诊中" | "待收费" | "已完成" | "已取消";

export interface VisitOut {
  visit_id: number;
  pet_id: number;
  employee_id: number;
  visit_time: string;
  complaint: string | null;
  status: VisitStatus;
  pet_name: string | null;
  customer_name: string | null;
}

export interface VisitCreate {
  pet_id: number;
  employee_id: number;
  complaint?: string | null;
}

export interface VisitDetail {
  visit_id: number;
  pet_id: number;
  pet_name: string;
  species: string;
  breed: string | null;
  customer_name: string;
  employee_id: number;
  doctor_name: string;
  visit_time: string;
  complaint: string | null;
  status: VisitStatus;
  diagnosis: DiagnosisOut | null;
  prescriptions: PrescriptionDetail[];
}

export interface DiagnosisCreate {
  diagnosis_result: string;
  notes?: string | null;
}

export interface DiagnosisOut {
  diagnosis_id: number;
  diagnosis_result: string;
  notes: string | null;
}

export interface PrescriptionCreate {
  items: { batch_id: number; quantity: number; dosage?: string | null }[];
}

export interface PrescriptionDetail {
  item_id: number;
  batch_id: number;
  medicine_name: string;
  quantity: number;
  dosage: string | null;
}

export interface CustomerVisitHistory {
  visit_id: number;
  pet_id: number;
  pet_name: string;
  employee_id: number;
  visit_time: string;
  complaint: string | null;
  status: string;
  diagnosis: { diagnosis_id: number; diagnosis_result: string; notes: string | null } | null;
  medical_record: Record<string, unknown> | null;
}

// 账单
export type BillStatus = "未结清" | "已结清";

export interface BillOut {
  bill_id: number;
  visit_id: number;
  status: BillStatus;
  created_at: string;
  total_amount: string | null;
  pet_name: string | null;
  customer_name: string | null;
}

export interface BillDetail {
  bill_id: number;
  visit_id: number;
  status: BillStatus;
  created_at: string;
  total_amount: string;
  pet_name: string | null;
  customer_name: string | null;
  items: BillItemOut[];
}

export interface BillItemOut {
  bill_item_id: number;
  bill_id: number;
  item_type: string;
  source_type: string;
  source_id: number;
  description: string | null;
  amount: string;
}

export interface BillItemCreate {
  item_type: string;
  source_type: string;
  source_id: number;
  amount: number;
  description?: string | null;
}

// 住院
export type HospStatus = "住院中" | "已出院";

export interface WardOut {
  ward_id: number;
  ward_no: string;
  type: string;
  status: string;
  daily_rate: string;
}

export interface WardCreate {
  ward_no: string;
  type: string;
  daily_rate: number;
}

export interface WardUpdate {
  ward_no?: string | null;
  type?: string | null;
  daily_rate?: number | null;
}

export interface HospListOut {
  hosp_id: number;
  visit_id: number;
  ward_id: number;
  ward_no: string;
  ward_type: string;
  admit_date: string;
  discharge_date: string | null;
  status: HospStatus;
  pet_id: number;
  pet_name: string | null;
  customer_name: string | null;
}

export interface HospDetail {
  hosp_id: number;
  visit_id: number;
  ward_id: number;
  ward_no: string;
  ward_type: string;
  admit_date: string;
  discharge_date: string | null;
  status: HospStatus;
  pet_name: string | null;
  customer_name: string | null;
  nursing_records: NursingRecord[];
}

export interface NursingRecord {
  record_id: number;
  hosp_id: number;
  employee_id: number;
  nurse_name: string;
  record_time: string;
  content: string;
}

export interface AdmitCreate {
  visit_id: number;
  ward_id: number;
  admit_date: string;
}

export interface NursingCreate {
  employee_id: number;
  content: string;
}

// 寄养
export interface BoardingListOut {
  boarding_id: number;
  pet_id: number;
  pet_name: string;
  ward_id: number;
  ward_no: string;
  start_date: string;
  end_date: string | null;
  photo_key: string | null;
}

export interface BoardingDetail {
  boarding_id: number;
  pet_id: number;
  pet_name: string;
  ward_id: number;
  ward_no: string;
  daily_rate: string;
  start_date: string;
  end_date: string | null;
  current_fee: string;
  photo_key: string | null;
}

export interface BoardingCreate {
  pet_id: number;
  ward_id: number;
  start_date: string;
  photo_key?: string | null;
}

// 员工
export interface EmployeeOut {
  employee_id: number;
  name: string;
  role: string;
  phone: string;
}

// 寄养结束响应
export interface EndBoardingResponse {
  boarding_id: number;
  end_date: string;
  days: number;
  total_fee: string;
}

// API 通用响应
export interface ApiError {
  detail: string;
}
