/**
 * API service for invite-related operations
 */

import { apiClient } from './client';
import { Invite, ApiResponse } from './types';

export const invitesApi = {
  /**
   * Get all pending invites for the current user
   */
  getAll: async (): Promise<Invite[]> => {
    return apiClient.get<Invite[]>('/invites');
  },

  /**
   * Send an invite to a user
   */
  send: async (squadId: string, username: string): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/squads/${squadId}/invite`, { username });
  },

  /**
   * Respond to an invite (accept or decline)
   */
  respond: async (inviteId: string, response: 'accept' | 'decline'): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>(`/invites/${inviteId}/respond`, { response });
  },

  /**
   * Get all invites for a specific squad (admin only)
   */
  getBySquad: async (squadId: string): Promise<Invite[]> => {
    return apiClient.get<Invite[]>(`/squads/${squadId}/invites`);
  },
};
