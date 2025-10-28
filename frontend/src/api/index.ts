/**
 * Centralized API exports
 * Import API services from this file: import { squadsApi, goalsApi } from '@/api'
 */

export { apiClient, ApiError } from './client';
export { squadsApi } from './squads';
export { invitesApi } from './invites';
export { goalsApi } from './goals';
export { authApi } from './auth';
export * from './types';
