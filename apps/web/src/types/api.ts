/**
 * Standard success response from API
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard error response from API
 */
export interface ApiErrorResponse {
  error: string;
}

/**
 * Paginated response from API
 */
export interface PaginatedResponse<T> {
  members?: T[]; // or data, items, etc. depending on endpoint
  totalCount: number;
  hasMore: boolean;
}
