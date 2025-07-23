import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { getUserFriendlyErrorMessage } from "@/lib/retry-utils";

interface NetworkErrorProps {
  error: any;
  onRetry?: () => void;
  className?: string;
}

export function NetworkError({ error, onRetry, className }: NetworkErrorProps) {
  const errorInfo = getUserFriendlyErrorMessage(error);
  const isNetworkError = !error?.status && error?.message?.includes('fetch');
  
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4">
          {isNetworkError ? (
            <WifiOff className="h-12 w-12 text-gray-400" />
          ) : (
            <AlertCircle className="h-12 w-12 text-red-500" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">{errorInfo.title}</h3>
        <p className="text-sm text-gray-600 mb-4 max-w-md">{errorInfo.description}</p>
        
        {errorInfo.action && (
          <p className="text-sm text-gray-500 mb-4">{errorInfo.action}</p>
        )}
        
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
        
        {error?.status === 401 && (
          <Button
            onClick={() => window.location.href = '/login'}
            variant="default"
            size="sm"
            className="mt-2"
          >
            Go to Login
          </Button>
        )}
      </CardContent>
    </Card>
  );
}