export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: 'superadmin' | 'admin' | 'user';
  password_hash: string;
  first_login: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: number;
  work_order_no: string;
  work_order_date: string;
  equipment_number: string;
  km_hrs?: number;
  requested_by: string;
  requested_by_id?: number;
  work_type: string;
  job_allocation_time: string;
  description?: string;
  work_completed_date?: string;
  completion_requested_by?: number;
  completion_requested_at?: string;
  completion_approved_by?: number;
  completion_approved_at?: string;
  completion_rejection_reason?: string;
  completion_approved_by_name?: string;
  completion_requested_by_name?: string;
  reference_document?: string;
  status: 'pending' | 'ongoing' | 'completion_requested' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: number;
  work_order_id: number;
  description: string;
  reference_image?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionTechnician {
  id: number;
  action_id: number;
  technician_id?: number;
  name: string;
  staff_id: string;
  created_at: string;
}

export interface ActionDate {
  id: number;
  action_id: number;
  action_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  technicians?: ActionTechnician[];
}

export interface Action {
  id: number;
  finding_id: number;
  description: string;
  action_date: string;
  start_time: string;
  end_time?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  technicians?: ActionTechnician[];
  action_dates?: ActionDate[];
  is_completed?: boolean;
}

export interface SparePart {
  id: number;
  action_id: number;
  part_name: string;
  part_number: string;
  quantity: number;
  unit?: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: number;
  name: string;
  staff_id: string;
  designation?: string;
  level?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'approval' | 'rejection' | 'completion' | 'info';
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: number;
  created_at: string;
  expires_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DashboardStats {
  ongoing: number;
  completed: number;
  total: number;
}

export interface WorkOrderFilters {
  equipment_number?: string;
  work_type?: string;
  requested_by?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} 

export interface TechnicianPerformance {
  technician_id?: number;
  name: string;
  staff_id: string;
  actions_worked: number;
  completed_actions: number;
  total_minutes: number;
}