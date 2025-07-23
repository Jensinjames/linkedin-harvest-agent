import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CloudUpload, FileSpreadsheet, X, Play, Pause } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useJobProcessing } from "@/hooks/use-job-processing";
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

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  profileCount: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
}

export default function FileUploadSection() {
  const [batchSize, setBatchSize] = useState("50");
  
  const {
    dragActive,
    setDragActive,
    handleDrop,
    openFileDialog,
    isUploading,
  } = useFileUpload();

  const {
    hasActiveJob,
    currentJob,
    startJob,
    pauseJob,
    resumeJob,
    isStarting,
    isPausing,
    isResuming,
  } = useJobProcessing();

  const { data: uploadedFiles = [], isLoading } = useQuery<UploadedFile[]>({
    queryKey: ["/api/files/uploaded"],
  });

  const removeFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest("DELETE", `/api/files/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files/uploaded"] });
    },
  });

  const handleStartProcessing = () => {
    const firstUploadedFile = uploadedFiles.find(f => f.status === 'uploaded');
    if (firstUploadedFile) {
      startJob({
        fileId: firstUploadedFile.id,
        batchSize: parseInt(batchSize),
      });
    }
  };

  const handlePauseResume = () => {
    if (currentJob) {
      if (currentJob.status === 'processing') {
        pauseJob(currentJob.id);
      } else if (currentJob.status === 'paused') {
        resumeJob(currentJob.id);
      }
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-text-dark">
          File Upload & Processing
        </h2>
        <p className="text-sm text-neutral-gray mt-1">
          Upload Excel files containing LinkedIn profile URLs for batch processing
        </p>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* File Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragActive ? 'border-azure-blue bg-azure-blue bg-opacity-5' : 'border-gray-300 hover:border-azure-blue'
          }`}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <div className="mx-auto w-16 h-16 bg-azure-blue bg-opacity-10 rounded-full flex items-center justify-center mb-4">
            <CloudUpload className="text-azure-blue text-2xl" />
          </div>
          <h3 className="text-lg font-medium text-text-dark mb-2">
            Drop Excel files here
          </h3>
          <p className="text-neutral-gray mb-4">
            or click to browse and upload .xlsx files
          </p>
          <Button 
            className="bg-azure-blue text-white hover:bg-azure-dark"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Choose Files'}
          </Button>
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="text-success-green text-xl" />
                  <div>
                    <p className="font-medium text-text-dark">{file.name}</p>
                    <p className="text-sm text-neutral-gray">
                      {file.profileCount.toLocaleString()} URLs • {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    file.status === 'uploaded' ? 'bg-azure-blue bg-opacity-10 text-azure-blue' :
                    file.status === 'processing' ? 'bg-warning-orange bg-opacity-10 text-warning-orange' :
                    file.status === 'completed' ? 'bg-success-green bg-opacity-10 text-success-green' :
                    'bg-error-red bg-opacity-10 text-error-red'
                  }`}>
                    {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-neutral-gray hover:text-error-red"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove file?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{file.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeFileMutation.mutate(file.id)}
                          className="bg-error-red hover:bg-red-700"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Processing Controls */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <label htmlFor="batch-size-select" className="text-sm font-medium text-text-dark">Batch Size:</label>
            <Select value={batchSize} onValueChange={setBatchSize}>
              <SelectTrigger id="batch-size-select" name="batchSize" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 profiles</SelectItem>
                <SelectItem value="100">100 profiles</SelectItem>
                <SelectItem value="250">250 profiles</SelectItem>
                <SelectItem value="500">500 profiles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-3">
            {hasActiveJob && currentJob && (
              <Button
                variant="outline"
                onClick={handlePauseResume}
                disabled={isPausing || isResuming}
                className="border-gray-300 text-neutral-gray hover:bg-gray-50"
              >
                {currentJob.status === 'processing' ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    {isPausing ? 'Pausing...' : 'Pause'}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {isResuming ? 'Resuming...' : 'Resume'}
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleStartProcessing}
              disabled={isStarting || uploadedFiles.length === 0 || hasActiveJob}
              className="bg-azure-blue text-white hover:bg-azure-dark"
            >
              <Play className="mr-2 h-4 w-4" />
              {isStarting ? 'Starting...' : 'Start Processing'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
