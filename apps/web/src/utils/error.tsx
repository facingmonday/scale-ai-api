import axios from "axios";

/**
 * Helper function to extract error message from API errors
 * Handles axios errors, Error instances, and unknown error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData) {
      if (typeof responseData === "string") {
        return responseData;
      }
      if (typeof responseData === "object") {
        return (
          (responseData as { error?: string }).error ||
          (responseData as { message?: string }).message ||
          error.response?.statusText ||
          error.message
        );
      }
    }
    return error.response?.statusText || error.message || "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
};

