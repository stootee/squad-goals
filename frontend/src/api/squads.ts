/**
 * API service for squad-related operations
 */

import { apiClient } from './client';
import { Squad, SquadMember, ApiResponse } from './types';

export const squadsApi = {
  /**
   * Get all squads for the current user
   */
  getAll: async (): Promise<Squad[]> => {
    return apiClient.get<Squad[]>('/squads');
  },

  /**
   * Get a specific squad by ID
   */
  getById: async (squadId: string): Promise<Squad> => {
    return apiClient.get<Squad>(`/squads/${squadId}`);
  },

  /**
   * Create a new squad
   */
  create: async (name: string): Promise<Squad> => {
    return apiClient.post<Squad>('/squads', { name });
  },

  /**
   * Update squad details
   */
  update: async (squadId: string, name: string): Promise<ApiResponse> => {
    return apiClient.put<ApiResponse>(`/squads/${squadId}`, { name });
  },

  /**
   * Delete a squad (admin only)
   */
  delete: async (squadId: string): Promise<ApiResponse> => {
    return apiClient.delete<ApiResponse>(`/squads/${squadId}`);
  },

  /**
   * Get all members of a squad
   */
  getMembers: async (squadId: string): Promise<SquadMember[]> => {
    return apiClient.get<SquadMember[]>(`/squads/${squadId}/members`);
  },

  /**
   * Remove a member from a squad (admin only)
   */
  removeMember: async (squadId: string, userId: string): Promise<ApiResponse> => {
    return apiClient.delete<ApiResponse>(`/squads/${squadId}/members/${userId}`);
  },

  /**
   * Leave a squad
   */
  leave: async (squadId: string): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/squads/${squadId}/leave`);
  },
};
