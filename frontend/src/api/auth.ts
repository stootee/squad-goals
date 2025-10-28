/**
 * API service for authentication and user profile operations
 */

import { apiClient } from './client';
import { UserProfile, ProfileSaveResponse, ApiResponse } from './types';

export const authApi = {
  /**
   * Get current user's profile
   */
  getProfile: async (): Promise<UserProfile> => {
    return apiClient.get<UserProfile>('/profile');
  },

  /**
   * Update user profile
   */
  updateProfile: async (profile: UserProfile): Promise<ProfileSaveResponse> => {
    return apiClient.post<ProfileSaveResponse>('/profile', profile);
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<ApiResponse> => {
    return apiClient.post<ApiResponse>('/logout');
  },
};
