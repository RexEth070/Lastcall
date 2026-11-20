import { PageLoadingSkeleton } from "@/components/ui/state-views";

export default function SubscriptionsLoading() {
  return <PageLoadingSkeleton cards={3} rows={5} />;
}
