import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { type Job, type Profile } from "@shared/schema";
import StorageDataTable from "@/components/storage-data-table";
import { 
  Bot, 
  Brain, 
  Users, 
  Target, 
  MessageSquare, 
  Sparkles, 
  TrendingUp,
  UserCheck,
  MapPin,
  Briefcase,
  Star,
  Lightbulb,
  Database
} from "lucide-react";

interface ProfileAnalysis {
  summary: string;
  keySkills: string[];
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Executive';
  industryFocus: string;
  strengths: string[];
  potentialRoles: string[];
  networkingScore: number;
  recommendations: string[];
}

interface BulkAnalysis {
  totalProfiles: number;
  industryBreakdown: Record<string, number>;
  skillsFrequency: Record<string, number>;
  experienceDistribution: Record<string, number>;
  topTalent: Array<{ name: string; reason: string; linkedinUrl: string }>;
  insights: string[];
  recommendations: string[];
}

export default function AIAssistant() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [chatMessage, setChatMessage] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; message: string }>>([]);

  // Fetch recent jobs for analysis
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs/recent"],
  });

  // Fetch job profiles when job is selected
  const { data: jobProfilesData } = useQuery<{ profiles: Profile[] }>({
    queryKey: ["/api/profiles", selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return { profiles: [] };
      const response = await apiRequest("GET", `/api/jobs/${selectedJobId}/profiles`);
      return response.json();
    },
    enabled: !!selectedJobId,
  });
  
  const jobProfiles = jobProfilesData?.profiles || [];

  // AI Analysis mutations
  const analyzeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/ai/analyze-job/${jobId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Job Analysis Complete",
        description: `Successfully analyzed ${data.totalProfiles} profiles`,
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze job profiles. Please try again.",
        variant: "destructive",
      });
    },
  });

  const recruitingInsightsMutation = useMutation({
    mutationFn: async ({ jobId, jobTitle }: { jobId: string; jobTitle: string }) => {
      const response = await apiRequest("POST", `/api/ai/recruiting-insights/${jobId}`, {
        body: JSON.stringify({ jobTitle }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recruiting Insights Generated",
        description: "AI has analyzed your profiles for recruiting insights",
      });
    },
    onError: () => {
      toast({
        title: "Insights Failed",
        description: "Failed to generate recruiting insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async ({ message, jobId }: { message: string; jobId?: string }) => {
      const response = await apiRequest("POST", "/api/ai/chat", {
        body: JSON.stringify({ message, jobId }),
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', message: variables.message },
        { role: 'assistant', message: data.response }
      ]);
      setChatMessage("");
    },
    onError: () => {
      toast({
        title: "Chat Failed",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChat = () => {
    if (!chatMessage.trim()) return;
    chatMutation.mutate({ 
      message: chatMessage, 
      jobId: selectedJobId || undefined 
    });
  };

  const handleJobAnalysis = () => {
    if (!selectedJobId) {
      toast({
        title: "No Job Selected",
        description: "Please select a job to analyze",
        variant: "destructive",
      });
      return;
    }
    analyzeJobMutation.mutate(selectedJobId);
  };

  const handleRecruitingInsights = () => {
    if (!selectedJobId || !jobTitle.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a job and enter a job title",
        variant: "destructive",
      });
      return;
    }
    recruitingInsightsMutation.mutate({ jobId: selectedJobId, jobTitle });
  };

  const selectedJob = jobs.find((job) => job.id.toString() === selectedJobId);
  const successfulProfiles = jobProfiles.filter((p) => p.status === 'success');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-lg">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Assistant</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Intelligent analysis and insights for your LinkedIn data
          </p>
        </div>
      </div>

      {/* Job Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Select Job for Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="job-select" className="text-sm font-medium mb-2 block">Job</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger id="job-select" name="job">
                  <SelectValue placeholder="Choose a completed job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs
                    .filter((job) => job.status === 'completed')
                    .map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.fileName} ({job.successfulProfiles} profiles)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="job-title-input" className="text-sm font-medium mb-2 block">Target Job Title (Optional)</label>
              <Input
                id="job-title-input"
                name="jobTitle"
                autoComplete="organization-title"
                placeholder="e.g., Software Engineer, Product Manager"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>
          
          {selectedJob && (
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Total Profiles</div>
                  <div className="text-2xl font-bold text-blue-600">{selectedJob.totalProfiles}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Successful</div>
                  <div className="text-2xl font-bold text-green-600">{selectedJob.successfulProfiles}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Success Rate</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(((selectedJob.successfulProfiles || 0) / selectedJob.totalProfiles) * 100)}%
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Status</div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {selectedJob.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analysis" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>Bulk Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center space-x-2">
            <Lightbulb className="h-4 w-4" />
            <span>Recruiting Insights</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>AI Chat</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Storage Data</span>
          </TabsTrigger>
        </TabsList>

        {/* Bulk Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Bulk Profile Analysis</span>
              </CardTitle>
              <CardDescription>
                Analyze all successful profiles in your selected job to identify patterns, skills, and talent distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={handleJobAnalysis}
                  disabled={!selectedJobId || analyzeJobMutation.isPending}
                  className="w-full"
                >
                  {analyzeJobMutation.isPending ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing Profiles...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze {successfulProfiles.length} Profiles
                    </>
                  )}
                </Button>

                {analyzeJobMutation.data && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    
                    {/* Industry Breakdown */}
                    <div>
                      <h4 className="font-medium mb-2">Industry Distribution</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(analyzeJobMutation.data.industryBreakdown).map(([industry, count]) => (
                          <div key={industry} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                            <div className="font-medium">{industry}</div>
                            <div className="text-sm text-gray-600">{count as number} profiles</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Experience Distribution */}
                    <div>
                      <h4 className="font-medium mb-2">Experience Level Distribution</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(analyzeJobMutation.data.experienceDistribution).map(([level, count]) => (
                          <div key={level} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                            <div className="font-medium">{level}</div>
                            <div className="text-sm text-gray-600">{count as number} profiles</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Talent */}
                    {analyzeJobMutation.data.topTalent.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Top Talent Identified</h4>
                        <div className="space-y-2">
                          {analyzeJobMutation.data.topTalent.map((talent: any, index: number) => (
                            <div key={index} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{talent.name}</div>
                                <Star className="h-4 w-4 text-yellow-500" />
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{talent.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    <div>
                      <h4 className="font-medium mb-2">Key Insights</h4>
                      <ul className="space-y-1">
                        {analyzeJobMutation.data.insights.map((insight: string, index: number) => (
                          <li key={index} className="text-sm flex items-start space-x-2">
                            <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recruiting Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Recruiting Strategy Insights</span>
              </CardTitle>
              <CardDescription>
                Generate targeted recruiting insights based on profile analysis for specific roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={handleRecruitingInsights}
                  disabled={!selectedJobId || !jobTitle.trim() || recruitingInsightsMutation.isPending}
                  className="w-full"
                >
                  {recruitingInsightsMutation.isPending ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Generating Insights...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Generate Recruiting Insights
                    </>
                  )}
                </Button>

                {recruitingInsightsMutation.data && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-semibold">Recruiting Insights</h3>
                    <div className="space-y-3">
                      {recruitingInsightsMutation.data.insights.map((insight: string, index: number) => (
                        <div key={index} className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r">
                          <div className="flex items-start space-x-2">
                            <UserCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{insight}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Chat with AI Assistant</span>
              </CardTitle>
              <CardDescription>
                Ask questions about your LinkedIn data and get intelligent insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Chat History */}
                <div className="h-64 overflow-y-auto border rounded-lg p-4 space-y-3">
                  {chatHistory.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Bot className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>Start a conversation with the AI Assistant!</p>
                      <p className="text-sm">Ask about profiles, trends, or recruiting strategies.</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="text-sm">{msg.message}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex space-x-2">
                  <label htmlFor="chat-textarea" className="sr-only">Chat message</label>
                  <Textarea
                    id="chat-textarea"
                    name="chatMessage"
                    aria-label="Type your message about LinkedIn data analysis"
                    placeholder="Ask me anything about your LinkedIn data..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChat();
                      }
                    }}
                    className="flex-1"
                    rows={3}
                  />
                  <Button
                    onClick={handleChat}
                    disabled={!chatMessage.trim() || chatMutation.isPending}
                    className="px-6"
                  >
                    {chatMutation.isPending ? (
                      <Sparkles className="h-4 w-4 animate-spin" />
                    ) : (
                      'Send'
                    )}
                  </Button>
                </div>

                {selectedJobId && (
                  <div className="text-xs text-gray-500">
                    Context: Analyzing data from {selectedJob?.fileName} ({successfulProfiles.length} profiles)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Data Tab */}
        <TabsContent value="storage" className="space-y-4">
          <StorageDataTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}