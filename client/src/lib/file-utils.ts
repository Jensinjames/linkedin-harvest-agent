import { apiRequest } from '@/lib/queryClient';

export async function uploadFile(file: File): Promise<{ id: string; profileCount: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to upload file');
  }

  return response.json();
}