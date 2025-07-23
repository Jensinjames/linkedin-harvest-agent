import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkError } from "@/components/ui/network-error";
import { apiRequest } from "@/lib/queryClient";
import { type Job, type Profile } from "@shared/schema";
import { 
  Database, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye
} from "lucide-react";
import ProfileModal from "./profile-modal";

interface StorageStats {
  totalJobs: number;
  totalProfiles: number;
  successfulProfiles: number;
  failedProfiles: number;
  dataSize: string;
}

export default function StorageDataTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const itemsPerPage = 10;

  // Fetch storage statistics
  const { data: storageStats } = useQuery<StorageStats>({
    queryKey: ["/api/storage/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch jobs with pagination
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<{
    jobs: Job[];
    total: number;
  }>({
    queryKey: ["/api/jobs", currentPage, searchTerm],
    queryFn: async () => {
      const response = await apiRequest(
        "GET", 
        `/api/jobs?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`
      );
      return response.json();
    },
  });

  // Fetch profiles for selected job
  const { data: profilesData, isLoading: profilesLoading } = useQuery<{
    profiles: Profile[];
    total: number;
  }>({
    queryKey: ["/api/profiles", selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return { profiles: [], total: 0 };
      const response = await apiRequest("GET", `/api/jobs/${selectedJobId}/profiles`);
      return response.json();
    },
    enabled: !!selectedJobId,
  });

  const totalPages = Math.ceil((jobsData?.total || 0) / itemsPerPage);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'bg-success-green';
      case 'failed':
        return 'bg-error-red';
      case 'processing':
        return 'bg-azure-blue';
      case 'paused':
        return 'bg-warning-orange';
      default:
        return 'bg-neutral-gray';
    }
  };

  return (
    <>
      <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-azure-blue" />
            <CardTitle className="text-xl font-semibold text-text-dark">
              Storage Data Explorer
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchJobs()}
            className="text-azure-blue border-azure-blue hover:bg-azure-blue hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Storage Statistics */}
        {!storageStats ? (
          <div className="grid grid-cols-5 gap-4 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-8 w-16 mx-auto mb-1" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-text-dark">{storageStats.totalJobs}</p>
              <p className="text-xs text-neutral-gray">Total Jobs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-text-dark">{storageStats.totalProfiles}</p>
              <p className="text-xs text-neutral-gray">Total Profiles</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success-green">{storageStats.successfulProfiles}</p>
              <p className="text-xs text-neutral-gray">Successful</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-error-red">{storageStats.failedProfiles}</p>
              <p className="text-xs text-neutral-gray">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-text-dark">{storageStats.dataSize}</p>
              <p className="text-xs text-neutral-gray">Data Size</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-6">
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="profiles" disabled={!selectedJobId}>
              Profiles {selectedJobId && `(Job ${selectedJobId})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-gray h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10"
              />
            </div>

            {/* Jobs Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">File Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Progress</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-48" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <Skeleton className="h-2 w-full rounded-full mb-1" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-8 w-20 rounded" />
                        </td>
                      </tr>
                    ))
                  ) : jobsData?.jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-gray">
                        No jobs found
                      </td>
                    </tr>
                  ) : (
                    jobsData?.jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-text-dark">{job.id}</td>
                        <td className="px-4 py-3 text-sm text-text-dark font-medium">
                          {job.fileName}
                          <div className="text-xs text-neutral-gray">
                            {job.totalProfiles} profiles
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${getStatusColor(job.status)} text-white`}>
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <Progress 
                              value={(job.processedProfiles || 0) / job.totalProfiles * 100} 
                              className="w-20 h-2"
                            />
                            <span className="text-xs text-neutral-gray">
                              {job.processedProfiles || 0}/{job.totalProfiles}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-gray">
                          {formatDate(job.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedJobId(job.id.toString())}
                            className="text-azure-blue hover:bg-azure-blue hover:text-white"
                          >
                            View Profiles
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-neutral-gray">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, jobsData?.total || 0)} of{" "}
                  {jobsData?.total || 0} jobs
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-text-dark">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profiles" className="space-y-4">
            {/* Profiles Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">LinkedIn URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Extracted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-gray uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profilesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-gray">
                        Loading profiles...
                      </td>
                    </tr>
                  ) : profilesData?.profiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-gray">
                        No profiles found
                      </td>
                    </tr>
                  ) : (
                    profilesData?.profiles.map((profile) => {
                      const profileData = profile.profileData as any;
                      return (
                        <tr key={profile.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-text-dark">{profile.id}</td>
                          <td className="px-4 py-3 text-sm text-azure-blue hover:underline">
                            <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                              {profile.linkedinUrl}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${getStatusColor(profile.status)} text-white`}>
                              {profile.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-dark">
                            {profileData?.firstName && profileData?.lastName
                              ? `${profileData.firstName} ${profileData.lastName}`
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-gray">
                            {formatDate(profile.extractedAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-error-red">
                            {profile.errorType || "None"}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProfile(profile);
                                setProfileModalOpen(true);
                              }}
                              className="text-azure-blue hover:bg-azure-blue hover:text-white"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    
    {/* Profile Modal */}
    <ProfileModal 
      open={profileModalOpen}
      onClose={() => {
        setProfileModalOpen(false);
        setSelectedProfile(null);
      }}
      profile={selectedProfile ? {
        linkedinUrl: selectedProfile.linkedinUrl,
        status: selectedProfile.status,
        profileData: selectedProfile.profileData as any,
        errorType: selectedProfile.errorType || undefined,
        errorMessage: selectedProfile.errorMessage || undefined
      } : null}
    />
    </>
  );
}