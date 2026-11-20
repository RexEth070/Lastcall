import { PageLoadingSkeleton } from "@/components/ui/state-views";

export default function ActivityLoading() {
  return <PageLoadingSkeleton cards={2} rows={4} />;
}
