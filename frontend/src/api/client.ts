/**
 * Centralized API client for all HTTP requests
 * Handles authentication, error responses, and common request patterns
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiConfig {
  baseURL: string;
  credentials: RequestCredentials;
}

class ApiClient {
  private config: ApiConfig;

  constructor() {
    // Default configuration
    this.config = {
      baseURL: this.getBaseURL(),
      credentials: 'include',
    };
  }

  private getBaseURL(): string {
    // Use window.APP_CONFIG if available, otherwise fallback to /api
    if (typeof window !== 'undefined' && window.APP_CONFIG?.API_URL) {
      return window.APP_CONFIG.API_URL;
    }
    return '/api';
  }

  /**
   * Handle API response, checking for errors and redirecting on 401
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 401 - Unauthorized
    if (response.status === 401) {
      console.warn('Unauthorized - redirecting to login');
      window.location.href = '/login.html';
      throw new ApiError('Unauthorized', 401);
    }

    // Try to parse JSON response
    let data: any;
    try {
      data = await response.json();
    } catch (err) {
      // If JSON parsing fails but response was ok, return empty object
      if (response.ok) {
        return {} as T;
      }
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    // If response is not ok, throw error with message from server
    if (!response.ok) {
      const message = data.message || data.error || `HTTP ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data as T;
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'GET',
      credentials: this.config.credentials,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: this.config.credentials,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a PUT request
   */
  async put<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: this.config.credentials,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'DELETE',
      credentials: this.config.credentials,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: this.config.credentials,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
