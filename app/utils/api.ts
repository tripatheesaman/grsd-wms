import { ApiResponse } from '../types';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '/wms/api').replace(/\/$/, '');

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function getBasePath(): string {
  const explicitBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  if (explicitBasePath) return explicitBasePath;
  if (API_BASE.endsWith('/api')) return API_BASE.slice(0, -4);
  return '';
}

export function toPublicUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const basePath = getBasePath();
  if (!basePath) return normalizedPath;
  if (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
}

export function toUploadApiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;

  const basePath = getBasePath();
  const apiBase = getApiBaseUrl();
  let normalized = path.trim();

  if (basePath && normalized.startsWith(`${basePath}/api/uploads/`)) {
    return normalized;
  }

  if (basePath && normalized.startsWith(`${basePath}/uploads/`)) {
    normalized = normalized.slice(`${basePath}/uploads/`.length);
  } else if (normalized.startsWith('/uploads/')) {
    normalized = normalized.slice('/uploads/'.length);
  } else if (normalized.startsWith('uploads/')) {
    normalized = normalized.slice('uploads/'.length);
  } else if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  return `${apiBase}/uploads/${normalized}`;
}

class ApiClient {
  private baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found in localStorage');
      }
      return token;
    }
    return null;
  }
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      const data = await response.json();
      if (!response.ok && response.status === 401) {
        const token = this.getToken();
        console.error('Authentication error:', {
          hasToken: !!token,
          status: response.status,
          url: endpoint
        });
      }
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
  async getBlob(endpoint: string): Promise<{ ok: boolean; blob?: Blob; filename?: string; status: number; }> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const resp = await fetch(url, { method: 'GET', headers });
    const cd = resp.headers.get('Content-Disposition') || '';
    const match = /filename\s*=\s*"?([^";]+)"?/i.exec(cd || '');
    const filename = match ? decodeURIComponent(match[1]) : undefined;
    if (!resp.ok) {
      return { ok: false, status: resp.status };
    }
    const blob = await resp.blob();
    return { ok: true, blob, filename, status: resp.status };
  }
}

export const apiClient = new ApiClient(API_BASE);