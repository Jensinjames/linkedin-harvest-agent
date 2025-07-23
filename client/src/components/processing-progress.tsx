import { useJobProcessing } from "@/hooks/use-job-processing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/ui/network-error";
import { Pause, Play, Square, Clock, Activity, AlertCircle } from "lucide-react";

export default function ProcessingProgress() {
  const {
    hasActiveJob,
    currentJob,
    isLoading,
    error,
    pauseJob,
    resumeJob,
    cancelJob,
    isPausing,
    isResuming,
    isCancelling,
  } = useJobProcessing();

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span>Processing Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NetworkError error={error} onRetry={() => window.location.reload()} />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-gray-400" />
            <span>Processing Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasActiveJob || !currentJob) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-text-light" />
            <span>Processing Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-light">No active processing jobs</p>
        </CardContent>
      </Card>
    );
  }
}