import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { uploadFile } from "@/lib/file-utils";
import { toast } from "@/hooks/use-toast";

interface UseFileUploadOptions {
  allowedTypes?: string[];
  maxSizeMB?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    maxSizeMB = 50,
    onSuccess,
    onError,
  } = options;

  const [dragActive, setDragActive] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Validate file size
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
      }

      return await uploadFile(file);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files/uploaded"] });
      toast({
        title: "File uploaded successfully",
        description: "Your file has been processed and is ready for extraction.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      onError?.(error);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => allowedTypes.includes(file.type));
    
    if (validFile) {
      uploadMutation.mutate(validFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload Excel files (.xlsx or .xls) only.",
        variant: "destructive",
      });
    }
  }, [uploadMutation, allowedTypes]);

  const handleFileSelect = useCallback((file: File) => {
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const openFileDialog = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    };
    input.click();
  }, [handleFileSelect]);

  return {
    dragActive,
    setDragActive,
    handleDrop,
    handleFileSelect,
    openFileDialog,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    upload: uploadMutation.mutate,
  };
}