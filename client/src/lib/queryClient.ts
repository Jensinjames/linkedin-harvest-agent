import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { withRetry, parseError } from "./retry-utils";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`) as any;
    error.status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryOptions?: { maxRetries?: number; onRetryAttempt?: (error: any, attemptNumber: number) => void }
): Promise<Response> {
  return withRetry(async () => {
    const accessToken = localStorage.getItem("accessToken");
    const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
    
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle 401 errors
    if (res.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          
          if (refreshRes.ok) {
            const { accessToken: newAccessToken } = await refreshRes.json();
            localStorage.setItem("accessToken", newAccessToken);
            
            // Retry original request with new token
            headers["Authorization"] = `Bearer ${newAccessToken}`;
            const retryRes = await fetch(url, {
              method,
              headers,
              body: data ? JSON.stringify(data) : undefined,
              credentials: "include",
            });
            
            await throwIfResNotOk(retryRes);
            return retryRes;
          }
        } catch (error) {
          // Refresh failed
          localStorage.clear();
          window.location.href = "/login";
          throw new Error("Authentication failed");
        }
      } else {
        // No refresh token
        window.location.href = "/login";
        throw new Error("Authentication required");
      }
    }

    await throwIfResNotOk(res);
    return res;
  }, retryOptions);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    return withRetry(async () => {
      const accessToken = localStorage.getItem("accessToken");
      const headers: HeadersInit = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      
      const res = await fetch(queryKey.join("/") as string, {
        headers,
        credentials: "include",
        signal,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      // Handle 401 errors
      if (res.status === 401 && unauthorizedBehavior === "throw") {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          try {
            const refreshRes = await fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            
            if (refreshRes.ok) {
              const { accessToken: newAccessToken } = await refreshRes.json();
              localStorage.setItem("accessToken", newAccessToken);
              
              // Retry original request with new token
              const retryRes = await fetch(queryKey.join("/") as string, {
                headers: { "Authorization": `Bearer ${newAccessToken}` },
                credentials: "include",
                signal,
              });
              
              await throwIfResNotOk(retryRes);
              return await retryRes.json();
            }
          } catch (error) {
            // Refresh failed
            localStorage.clear();
            window.location.href = "/login";
            throw new Error("Authentication failed");
          }
        } else {
          // No refresh token
          window.location.href = "/login";
          throw new Error("Authentication required");
        }
      }

      await throwIfResNotOk(res);
      return await res.json();
    }, {
      onRetryAttempt: (error, attemptNumber) => {
        console.log(`Retrying request ${queryKey.join("/")} - attempt ${attemptNumber}`);
      }
    });
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: 3, // Enable retry with 3 attempts
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    },
    mutations: {
      retry: 2, // Enable retry for mutations
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});
