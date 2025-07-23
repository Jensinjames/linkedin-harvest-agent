import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/ui/network-error";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileSpreadsheet, Pause, Square, Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface JobData {
  id: string;
  fileName: string;
  totalProfiles: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  progress: number;
  successRate: string;
  startedAt: string;
}

export default function RecentJobsTable() {
  const { data: jobs = [], isLoading, error, refetch } = useQuery<JobData[]>({
    queryKey: ["/api/jobs/recent"],
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const pauseJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/pause`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recent"] });
    },
  });

  const stopJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/stop`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recent"] });
    },
  });

  const downloadResultsMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("GET", `/api/jobs/${jobId}/download`);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job_${jobId}_results.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recent"] });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-800' },
      processing: { bg: 'bg-azure-blue bg-opacity-10', text: 'text-azure-blue' },
      completed: { bg: 'bg-success-green bg-opacity-10', text: 'text-success-green' },
      failed: { bg: 'bg-error-red bg-opacity-10', text: 'text-error-red' },
      paused: { bg: 'bg-warning-orange bg-opacity-10', text: 'text-warning-orange' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  };

  if (isLoading) {
    return (
      <Card className="mt-8 bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-dark">
              Recent Processing Jobs
            </h2>
            <Skeleton className="h-4 w-16" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-8 rounded mr-3" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <Skeleton className="h-3 w-16 mb-2" />
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-3 w-12 mt-1" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-8 bg-white shadow-sm border border-gray-200">
        <CardHeader className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-dark">
              Recent Processing Jobs
            </h2>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <NetworkError error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 bg-white shadow-sm border border-gray-200">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-dark">
            Recent Processing Jobs
          </h2>
          <Button variant="link" className="text-azure-blue hover:text-azure-dark p-0">
            View All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <div className="p-6 text-center text-neutral-gray">
            No processing jobs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-gray uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileSpreadsheet className="text-success-green mr-3 h-5 w-5" />
                        <div>
                          <div className="text-sm font-medium text-text-dark">
                            {job.fileName}
                          </div>
                          <div className="text-sm text-neutral-gray">
                            {job.totalProfiles.toLocaleString()} profiles
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 mr-4">
                          <Progress value={job.progress} className="h-2" />
                        </div>
                        <span className="text-sm text-text-dark font-medium">
                          {job.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-dark">
                      {job.successRate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-gray">
                      {formatTimeAgo(job.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {job.status === 'processing' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => pauseJobMutation.mutate(job.id)}
                            className="text-azure-blue hover:text-azure-dark"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {(job.status === 'processing' || job.status === 'paused') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => stopJobMutation.mutate(job.id)}
                            className="text-neutral-gray hover:text-error-red"
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadResultsMutation.mutate(job.id)}
                            className="text-azure-blue hover:text-azure-dark"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-neutral-gray hover:text-error-red"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete job?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the job "{job.fileName}"? This action cannot be undone and all associated data will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteJobMutation.mutate(job.id)}
                                className="bg-error-red hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
