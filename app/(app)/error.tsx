"use client";

import { ErrorState } from "@/components/ui/state-views";

export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-6">
      <ErrorState
        title="Something went wrong while loading this workspace view"
        description={
          error.message ||
          "An unexpected error occurred. No cancellation action was executed."
        }
        onRetry={reset}
      />
    </div>
  );
}
