import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Linkedin, Home, Bot, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    username: string;
    linkedinConnected: boolean;
  };
}

export default function NavigationHeader() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
  });

  const linkedinAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/linkedin");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error) => {
      toast({
        title: "Authentication Error",
        description: "Failed to initiate LinkedIn authentication",
        variant: "destructive",
      });
    },
  });

  const handleLinkedInAuth = () => {
    linkedinAuthMutation.mutate();
  };

  const isLinkedInConnected = authStatus?.user?.linkedinConnected;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <Linkedin className="text-azure-blue text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-text-dark">
                LinkedIn Data Extraction Tool
              </h1>
            </div>
            
            {/* Navigation Links */}
            <nav className="flex space-x-1">
              <Link href="/">
                <Button
                  variant={location === "/" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <Link href="/ai-assistant">
                <Button
                  variant={location === "/ai-assistant" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Bot className="h-4 w-4" />
                  <span>AI Assistant</span>
                </Button>
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div 
                className={`w-2 h-2 rounded-full ${
                  isLinkedInConnected ? 'bg-success-green' : 'bg-error-red'
                }`}
              />
              <span className="text-sm text-neutral-gray">
                {isLinkedInConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {!isLinkedInConnected && (
              <Button
                onClick={handleLinkedInAuth}
                disabled={linkedinAuthMutation.isPending || isLoading}
                className="bg-azure-blue text-white hover:bg-azure-dark"
              >
                <Linkedin className="mr-2 h-4 w-4" />
                Connect LinkedIn
              </Button>
            )}
            
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{user.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
