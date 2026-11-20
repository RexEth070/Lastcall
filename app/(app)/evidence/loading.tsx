import { PageLoadingSkeleton } from "@/components/ui/state-views";

export default function EvidenceLoading() {
  return <PageLoadingSkeleton cards={2} rows={3} />;
}
