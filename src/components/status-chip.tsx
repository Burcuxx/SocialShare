import type { JobStatus } from "@/lib/db";

const KIND: Record<JobStatus, string> = {
  pending: "wait",
  downloading: "run",
  processing: "run",
  uploading: "run",
  done: "done",
  failed: "failed",
};

/** Color plus text: the text always names the state (and the platform when given). */
export function StatusChip({ status, children }: { status: JobStatus; children: React.ReactNode }) {
  return <span className={`badge ${KIND[status]}`}>{children}</span>;
}
