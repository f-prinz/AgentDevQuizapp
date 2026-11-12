import type { Snapshot } from "@raccoons/contracts";
import { submissionCount } from "./submission";

export function SubmissionCounter({ participants, className }: { participants: Snapshot["participants"]; className?: string }) {
  const { submitted, total } = submissionCount(participants);
  return <p className={["submission-counter", className].filter(Boolean).join(" ")} role="status">{submitted} von {total} abgegeben</p>;
}
