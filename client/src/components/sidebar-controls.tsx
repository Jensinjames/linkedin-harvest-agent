import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/ui/network-error";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Download, AlertCircle, FileText, Linkedin, Wifi } from "lucide-react";

interface AuthStatus {
  linkedinConnected: boolean;
  proxyActive: boolean;
  rateLimitInfo: {
    used: number;
    limit: number;
    resetTime: string;
  };
}

interface ErrorBreakdown {
  captchaBlocked: number;
  profileNotFound: number;
  accessRestricted: number;
}

interface ExportCounts {
  successful: number;
  failed: number;
  total: number;
}

export default function SidebarControls() {
  const { data: authStatus, isLoading: authLoading, error: authError } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status-detailed"],
  });

  const { data: errorBreakdown, isLoading: errorLoading, error: errorError } = useQuery<ErrorBreakdown>({
    queryKey: ["/api/stats/errors"],
  });

  const { data: exportCounts, isLoading: exportLoading, error: exportError } = useQuery<ExportCounts>({
    queryKey: ["/api/stats/export-counts"],
  });

  const exportMutation = useMutation({
    mutationFn: async (type: 'successful' | 'failed' | 'all') => {
      const response = await apiRequest("POST", `/api/export/${type}`);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkedin_data_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Export completed",
        description: "Your file has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reconnectLinkedInMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/linkedin/reconnect");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
  });

  const isLoading = authLoading || errorLoading || exportLoading;

  if (authError || errorError || exportError) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6">
          <h3 className="text-lg font-semibold text-text-dark">Controls</h3>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <NetworkError 
            error={authError || errorError || exportError} 
            onRetry={() => window.location.reload()} 
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Authentication Status */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6">
          <h3 className="text-lg font-semibold text-text-dark">Authentication</h3>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {authLoading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="pt-2 border-t border-gray-200">
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    authStatus?.linkedinConnected ? 'bg-success-green' : 'bg-error-red'
                  }`}></div>
                  <span className="text-sm font-medium">LinkedIn API</span>
                </div>
                {!authStatus?.linkedinConnected && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => reconnectLinkedInMutation.mutate()}
                    className="text-azure-blue hover:text-azure-dark p-0 h-auto"
                  >
                    Connect
                  </Button>
                )}
              </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  authStatus?.proxyActive ? 'bg-success-green' : 'bg-error-red'
                }`}></div>
                <span className="text-sm font-medium">Proxy Service</span>
              </div>
              <span className="text-sm text-neutral-gray">
                {authStatus?.proxyActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {authStatus?.rateLimitInfo && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm text-neutral-gray">
                  <p>
                    Rate Limit: <span className="font-medium text-text-dark">
                      {authStatus.rateLimitInfo.used}/{authStatus.rateLimitInfo.limit}
                    </span> requests/hour
                  </p>
                  <p className="mt-1">
                    Reset in: <span className="font-medium text-text-dark">
                      {authStatus.rateLimitInfo.resetTime}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6">
          <h3 className="text-lg font-semibold text-text-dark">Export Results</h3>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {exportLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
            <Button
              onClick={() => exportMutation.mutate('successful')}
              disabled={exportMutation.isPending}
              className="w-full bg-success-green text-white hover:bg-green-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Successful ({exportCounts?.successful || 0})
            </Button>
            
            <Button
              onClick={() => exportMutation.mutate('failed')}
              disabled={exportMutation.isPending}
              variant="outline"
              className="w-full border-gray-300 text-neutral-gray hover:bg-gray-50"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Export Failed ({exportCounts?.failed || 0})
            </Button>
            
            <Button
              onClick={() => exportMutation.mutate('all')}
              disabled={exportMutation.isPending}
              variant="outline"
              className="w-full border-azure-blue text-azure-blue hover:bg-azure-blue hover:text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              Export All Results
            </Button>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Error Breakdown */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6">
          <h3 className="text-lg font-semibold text-text-dark">Error Analysis</h3>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-3">
            {errorBreakdown && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-error-red rounded-full"></div>
                    <span className="text-sm">CAPTCHA Blocked</span>
                  </div>
                  <span className="text-sm font-medium text-text-dark">
                    {errorBreakdown.captchaBlocked}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-warning-orange rounded-full"></div>
                    <span className="text-sm">Profile Not Found</span>
                  </div>
                  <span className="text-sm font-medium text-text-dark">
                    {errorBreakdown.profileNotFound}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-neutral-gray rounded-full"></div>
                    <span className="text-sm">Access Restricted</span>
                  </div>
                  <span className="text-sm font-medium text-text-dark">
                    {errorBreakdown.accessRestricted}
                  </span>
                </div>
              </>
            )}
            
            <Button
              variant="outline"
              className="w-full mt-3 border-gray-300 text-neutral-gray hover:bg-gray-50"
            >
              View Detailed Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
