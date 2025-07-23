import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, 
  Building, 
  Briefcase, 
  GraduationCap, 
  Mail, 
  Phone,
  Users,
  Lightbulb
} from "lucide-react";

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  industry: string;
  location: string;
  publicProfileUrl: string;
  currentPosition?: string;
  currentCompany?: string;
  email?: string;
  phone?: string;
  connections?: number;
  profilePicture?: string;
  positions: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
  }>;
  skills: string[];
}

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: {
    linkedinUrl: string;
    status: string;
    profileData: ProfileData | null;
    errorType?: string;
    errorMessage?: string;
  } | null;
}

export default function ProfileModal({ open, onClose, profile }: ProfileModalProps) {
  if (!profile) return null;

  const data = profile.profileData;
  const isError = profile.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold">
            LinkedIn Profile Details
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-gray">
            View extracted profile information and data
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-100px)] pr-4">
          {isError ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">Extraction Failed</h3>
                <p className="text-red-700">
                  <span className="font-medium">Error Type:</span> {profile.errorType || 'Unknown'}
                </p>
                <p className="text-red-700 mt-1">
                  <span className="font-medium">Message:</span> {profile.errorMessage || 'No error message provided'}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium">Profile URL:</p>
                <a 
                  href={profile.linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-azure-blue hover:underline"
                >
                  {profile.linkedinUrl}
                </a>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-start space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={data.profilePicture} />
                  <AvatarFallback className="text-xl">
                    {data.firstName?.[0]}{data.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-text-dark">
                    {data.firstName} {data.lastName}
                  </h2>
                  <p className="text-lg text-gray-700 mt-1">{data.headline}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                    {data.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {data.location}
                      </div>
                    )}
                    {data.industry && (
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {data.industry}
                      </div>
                    )}
                    {data.connections && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {data.connections} connections
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              {(data.email || data.phone) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-text-dark flex items-center gap-2">
                      Contact Information
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      {data.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <a href={`mailto:${data.email}`} className="hover:text-azure-blue">
                            {data.email}
                          </a>
                        </div>
                      )}
                      {data.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <a href={`tel:${data.phone}`} className="hover:text-azure-blue">
                            {data.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Summary */}
              {data.summary && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-text-dark mb-2">Summary</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.summary}</p>
                  </div>
                </>
              )}

              {/* Experience */}
              {data.positions && data.positions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-text-dark mb-3 flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Experience
                    </h3>
                    <div className="space-y-4">
                      {data.positions.map((position, index) => (
                        <div key={index} className="border-l-2 border-gray-200 pl-4">
                          <h4 className="font-medium text-text-dark">{position.title}</h4>
                          <p className="text-sm text-gray-600">{position.company}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {position.startDate} - {position.endDate || 'Present'}
                          </p>
                          {position.description && (
                            <p className="text-sm text-gray-700 mt-2">{position.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Education */}
              {data.education && data.education.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-text-dark mb-3 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Education
                    </h3>
                    <div className="space-y-3">
                      {data.education.map((edu, index) => (
                        <div key={index}>
                          <h4 className="font-medium text-text-dark">{edu.school}</h4>
                          <p className="text-sm text-gray-600">
                            {edu.degree} in {edu.fieldOfStudy}
                          </p>
                          <p className="text-xs text-gray-500">
                            {edu.startDate} - {edu.endDate}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Skills */}
              {data.skills && data.skills.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-text-dark mb-3 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="bg-gray-100">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* LinkedIn URL */}
              <Separator />
              <div className="text-sm">
                <p className="font-medium text-gray-600 mb-1">LinkedIn Profile:</p>
                <a 
                  href={data.publicProfileUrl || profile.linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-azure-blue hover:underline"
                >
                  {data.publicProfileUrl || profile.linkedinUrl}
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No profile data available
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}