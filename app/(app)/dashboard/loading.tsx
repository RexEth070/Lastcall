import { PageLoadingSkeleton } from "@/components/ui/state-views";

export default function DashboardLoading() {
  return <PageLoadingSkeleton cards={4} rows={4} />;
}
