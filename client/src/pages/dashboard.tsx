import StatusOverview from "@/components/status-overview";
import FileUploadSection from "@/components/file-upload-section";
import ProcessingProgress from "@/components/processing-progress";
import SidebarControls from "@/components/sidebar-controls";
import RecentJobsTable from "@/components/recent-jobs-table";
import SystemHealth from "@/components/system-health";

export default function Dashboard() {
  return (
    <>
      <StatusOverview />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <FileUploadSection />
          <ProcessingProgress />
        </div>
        <div className="space-y-6">
          <SystemHealth />
          <SidebarControls />
        </div>
      </div>
      
      <RecentJobsTable />
    </>
  );
}
