/**
 * API service for goal-related operations
 */

import { apiClient } from './client';
import { Goal, GoalGroup, GoalEntry, ApiResponse } from './types';

export const goalsApi = {
  /**
   * Get all goals for a squad
   */
  getAll: async (squadId: string): Promise<Goal[]> => {
    return apiClient.get<Goal[]>(`/squads/${squadId}/goals`);
  },

  /**
   * Get goals by group ID
   */
  getByGroup: async (squadId: string, groupId: string): Promise<Goal[]> => {
    return apiClient.get<Goal[]>(`/squads/${squadId}/goals?group_id=${groupId}`);
  },

  /**
   * Create new goals (bulk)
   */
  create: async (squadId: string, goals: Partial<Goal>[]): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/squads/${squadId}/goals`, { goals });
  },

  /**
   * Update a goal
   */
  update: async (squadId: string, goalId: string, updates: Partial<Goal>): Promise<ApiResponse> => {
    return apiClient.put<ApiResponse>(`/squads/${squadId}/goals/${goalId}`, updates);
  },

  /**
   * Delete a goal
   */
  delete: async (squadId: string, goalId: string): Promise<ApiResponse> => {
    return apiClient.delete<ApiResponse>(`/squads/${squadId}/goals/${goalId}`);
  },

  /**
   * Get all goal groups for a squad
   */
  getGroups: async (squadId: string): Promise<GoalGroup[]> => {
    return apiClient.get<GoalGroup[]>(`/squads/${squadId}/goal-groups`);
  },

  /**
   * Create a goal group
   */
  createGroup: async (squadId: string, group: Partial<GoalGroup>): Promise<GoalGroup> => {
    return apiClient.post<GoalGroup>(`/squads/${squadId}/goal-groups`, group);
  },

  /**
   * Update a goal group
   */
  updateGroup: async (squadId: string, groupId: string, updates: Partial<GoalGroup>): Promise<ApiResponse> => {
    return apiClient.put<ApiResponse>(`/squads/${squadId}/goal-groups/${groupId}`, updates);
  },

  /**
   * Delete a goal group
   */
  deleteGroup: async (squadId: string, groupId: string): Promise<ApiResponse> => {
    return apiClient.delete<ApiResponse>(`/squads/${squadId}/goal-groups/${groupId}`);
  },

  /**
   * Get goal entries for a specific boundary
   */
  getEntries: async (squadId: string, params?: {
    goalGroupId?: string;
    boundaryValue?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<GoalEntry[]> => {
    const queryParams = new URLSearchParams();
    if (params?.goalGroupId) queryParams.append('goal_group_id', params.goalGroupId);
    if (params?.boundaryValue) queryParams.append('boundary_value', params.boundaryValue);
    if (params?.startDate) queryParams.append('start_date', params.startDate);
    if (params?.endDate) queryParams.append('end_date', params.endDate);

    const query = queryParams.toString();
    const path = `/squads/${squadId}/goals/entries${query ? `?${query}` : ''}`;

    return apiClient.get<GoalEntry[]>(path);
  },

  /**
   * Submit goal entries
   */
  submitEntries: async (squadId: string, entries: Partial<GoalEntry>[]): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/squads/${squadId}/goals/entries`, { entries });
  },

  /**
   * Get goal history
   */
  getHistory: async (squadId: string, params?: {
    goalGroupId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> => {
    const queryParams = new URLSearchParams();
    if (params?.goalGroupId) queryParams.append('goal_group_id', params.goalGroupId);
    if (params?.startDate) queryParams.append('start_date', params.startDate);
    if (params?.endDate) queryParams.append('end_date', params.endDate);
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());

    const query = queryParams.toString();
    const path = `/squads/${squadId}/goals/history${query ? `?${query}` : ''}`;

    return apiClient.get(path);
  },

  /**
   * Get all squad members' entries for a specific day or date range
   */
  getEntriesByDay: async (squadId: string, params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.startDate) queryParams.append('start_date', params.startDate);
    if (params?.endDate) queryParams.append('end_date', params.endDate);

    const query = queryParams.toString();
    const path = `/squads/${squadId}/goals/entries/day${query ? `?${query}` : ''}`;

    return apiClient.get(path);
  },

  /**
   * Get entry for a specific date/boundary
   */
  getEntry: async (squadId: string, date: string): Promise<any> => {
    return apiClient.get(`/squads/${squadId}/goals/entry?date=${date}`);
  },

  /**
   * Submit goal entry for a specific date/boundary
   */
  submitEntry: async (squadId: string, payload: { date: string | number; entries: any }): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/squads/${squadId}/goals/entry`, payload);
  },
};
