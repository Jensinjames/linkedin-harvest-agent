import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface JobStatus {
  hasActiveJob: boolean;
  currentJob?: {
    id: number;
    fileName: string;
    status: string;
    progress: number;
    processedProfiles: number;
    totalProfiles: number;
    successful: number;
    retrying: number;
    failed: number;
    remaining: number;
    processingRate?: string;
    estimatedCompletion?: string;
  };
}

export function useJobProcessing() {
  const { data: jobStatus, isLoading, error } = useQuery<JobStatus | null>({
    queryKey: ["/api/jobs/current-status"],
    refetchInterval: 5000, // Poll every 5 seconds
    retry: 3,
  });

  const startJobMutation = useMutation({
    mutationFn: async (data: { fileId: string; batchSize: number }) => {
      const response = await apiRequest("POST", "/api/jobs/start", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/current-status"] });
      toast({
        title: "Processing started",
        description: "LinkedIn profile extraction has been initiated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start processing",
        description: error.message || "Could not initiate the extraction process.",
        variant: "destructive",
      });
    },
  });

  const pauseJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/pause`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/current-status"] });
      toast({
        title: "Job paused",
        description: "Processing has been paused. You can resume it anytime.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to pause job",
        description: "Could not pause the processing job.",
        variant: "destructive",
      });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/resume`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/current-status"] });
      toast({
        title: "Job resumed",
        description: "Processing has been resumed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to resume job",
        description: "Could not resume the processing job.",
        variant: "destructive",
      });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/current-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recent"] });
      toast({
        title: "Job cancelled",
        description: "Processing has been cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to cancel job",
        description: "Could not cancel the processing job.",
        variant: "destructive",
      });
    },
  });

  return {
    jobStatus,
    isLoading,
    error,
    hasActiveJob: jobStatus?.hasActiveJob ?? false,
    currentJob: jobStatus?.currentJob,
    startJob: startJobMutation.mutate,
    pauseJob: pauseJobMutation.mutate,
    resumeJob: resumeJobMutation.mutate,
    cancelJob: cancelJobMutation.mutate,
    isStarting: startJobMutation.isPending,
    isPausing: pauseJobMutation.isPending,
    isResuming: resumeJobMutation.isPending,
    isCancelling: cancelJobMutation.isPending,
  };
}