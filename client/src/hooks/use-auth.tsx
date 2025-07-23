import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { auth } from '@webcontainer/api';

auth.init({
  clientId: 'wc_api_jensinjames_201c69ffcdc3ac5b72e8fb9c08a2de00',
  scope: '',
});
interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (response: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (storedUser && storedAccessToken) {
      setUser(JSON.parse(storedUser));
      setAccessToken(storedAccessToken);
      // Set the default authorization header
      if (typeof window !== 'undefined' && window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          if (args[1] && !args[1].headers) {
            args[1].headers = {};
          }
          if (args[1] && args[1].headers && storedAccessToken) {
            (args[1].headers as any)['Authorization'] = `Bearer ${storedAccessToken}`;
          }
          return originalFetch.apply(this, args);
        };
      }
    }
    setIsLoading(false);
  }, []);

  const login = (response: { user: User; accessToken: string; refreshToken: string }) => {
    setUser(response.user);
    setAccessToken(response.accessToken);
    
    // Store in localStorage
    localStorage.setItem("user", JSON.stringify(response.user));
    localStorage.setItem("accessToken", response.accessToken);
    localStorage.setItem("refreshToken", response.refreshToken);
    
    // Update the fetch interceptor
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        if (args[1] && !args[1].headers) {
          args[1].headers = {};
        }
        if (args[1] && args[1].headers && response.accessToken) {
          (args[1].headers as any)['Authorization'] = `Bearer ${response.accessToken}`;
        }
        return originalFetch.apply(this, args);
      };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await apiRequest("POST", "/api/auth/logout", { refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    // Clear state and localStorage
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    
    // Navigate to login
    navigate("/login");
  };

  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) throw new Error("No refresh token");

      const response = await apiRequest("POST", "/api/auth/refresh", { refreshToken });
      const data = await response.json();

      setAccessToken(data.accessToken);
      localStorage.setItem("accessToken", data.accessToken);
      
      return data.accessToken;
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}