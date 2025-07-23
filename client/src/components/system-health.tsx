
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/ui/network-error";
import { Wifi, WifiOff, CheckCircle, AlertCircle, Clock, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SystemHealth {
  linkedinConnected: boolean;
  proxyActive: boolean;
  rateLimitInfo: {
    used: number;
    limit: number;
    resetTime: string;
  };
  databaseStatus: 'connected' | 'error';
  apiResponseTime: number;
}

export default function SystemHealth() {
  const { data: health, isLoading, error } = useQuery<SystemHealth>({
    queryKey: ["/api/system/health"],
    refetchInterval: 10000, // Check every 10 seconds
    retry: 3,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-gray-400" />
            <span>System Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span>System Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NetworkError error={error} onRetry={() => window.location.reload()} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-green-500" />
          <span>System Health</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            {health?.linkedinConnected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">LinkedIn API</span>
            <Badge variant={health?.linkedinConnected ? "default" : "destructive"}>
              {health?.linkedinConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            {health?.proxyActive ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-orange-500" />
            )}
            <span className="text-sm">Proxy</span>
            <Badge variant={health?.proxyActive ? "default" : "secondary"}>
              {health?.proxyActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Rate Limit</span>
            </span>
            <span>{health?.rateLimitInfo.used}/{health?.rateLimitInfo.limit}</span>
          </div>
          <div className="text-xs text-text-light mt-1">
            Resets: {health?.rateLimitInfo.resetTime}
          </div>
        </div>

        {health?.apiResponseTime && (
          <div className="text-xs text-text-light">
            API Response Time: {health.apiResponseTime}ms
          </div>
        )}
      </CardContent>
    </Card>
  );
}
