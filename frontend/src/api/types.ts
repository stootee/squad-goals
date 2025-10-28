/**
 * Shared TypeScript types for API requests and responses
 */

export interface Squad {
  id: string;
  name: string;
  admin: string;
  admin_id?: string;
  is_admin: boolean;
  members: number;
  current_user_id?: string;
}

export interface Invite {
  id: string;
  squad: string;
  squad_id?: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
}

export interface UserProfile {
  name?: string;
  gender?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  goal_weight_kg?: number;
}

export interface ProfileSaveResponse {
  message: string;
  calorie_goal?: number;
  protein_goal?: number;
}

export interface Goal {
  id?: string;
  name: string;
  type: string;
  target?: string | number;
  target_max?: string | number;
  is_private: boolean;
  is_active: boolean;
  squad_id?: string;
  global_goal_id?: string;
  group_id: string;
  group_name: string;
  partition_type: PartitionType;
  partition_label?: string;
  start_date: string;
  end_date: string;
}

export type PartitionType =
  | "Minute"
  | "Hourly"
  | "Daily"
  | "Weekly"
  | "BiWeekly"
  | "Monthly"
  | "CustomCounter";

export interface GoalGroup {
  id: string;
  squad_id: string;
  group_name: string;
  partition_type: PartitionType;
  partition_label?: string;
  start_date: string;
  end_date: string;
  goal_ids: string[];
}

export interface GoalEntry {
  id?: string;
  user_id: string;
  goal_id: string;
  boundary_value: string;
  value?: string | number;
  status?: string;
  created_at?: string;
}

export interface SquadMember {
  id: string;
  username: string;
  is_admin: boolean;
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
}
