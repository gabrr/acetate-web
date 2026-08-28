import { forwardRef } from "react";

import { PRODUCT } from "@/config/product";
import { formatJobTime, friendlyStep } from "../mappers";
import type { ImportJob } from "../types";
import styles from "./processes.module.css";

export const ImportActivity = forwardRef<HTMLHeadingElement, { job: ImportJob; onChooseFileAgain?: () => void }>(
  function ImportActivity({ job, onChooseFileAgain }, ref) {
    const step = friendlyStep(job.current_step);
    const failed = job.status === "failed";
    const showReceived = Boolean(job.current_step && step !== "File received");

    return (
      <section className={styles.jobActivity} aria-labelledby="activity-title">
        <header className={styles.activityHeading}>
          <div>
            <h3 ref={ref} id="activity-title" tabIndex={-1}>Import activity</h3>
            <p>
              {failed
                ? "The import stopped before any transactions were saved."
                : `Updates appear here as ${PRODUCT.name} prepares your statement.`}
            </p>
          </div>
        </header>
        <ol className={styles.activityFeed} aria-live="polite" aria-relevant="additions text">
          {showReceived && <li className={styles.activityEvent}><time>{formatJobTime(job)}</time><strong>File received</strong></li>}
          <li className={`${styles.activityEvent} ${styles.currentEvent} ${failed ? styles.failedEvent : ""}`}>
            <time>{formatJobTime({ ...job, created_at: job.updated_at })}</time>
            <strong>{failed ? "Import failed" : step}</strong>
            {failed && job.error_message && <span>{job.error_message}</span>}
          </li>
        </ol>
        <div className={styles.activityNote}>
          <span>{failed ? "No transactions were saved. Choose the PDF again to start a new import." : "Transactions will appear here when processing finishes."}</span>
          {failed && onChooseFileAgain ? (
            <button className={styles.activityAction} type="button" onClick={onChooseFileAgain}>
              Choose PDF again
            </button>
          ) : null}
        </div>
      </section>
    );
  },
);
