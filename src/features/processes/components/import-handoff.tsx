"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import Image from "next/image";

import { ActionButton, IconActionButton } from "@/components/actions";
import { PRODUCT } from "@/config/product";
import { displayStatementFilename } from "../mappers";
import type { ImportJob } from "../types";
import styles from "./processes.module.css";

const stages = [
  ["copy.svg", "Convert to text"],
  ["sliders-horizontal.svg", "Normalize data"],
  ["plugs-connected.svg", "Categorize"],
  ["table.svg", "Save transactions"],
  ["check-circle.svg", "Ready in Statements"],
] as const;

export function ImportHandoff({ job, onDismiss, onView, returnFocusRef }: { job: ImportJob | null; onDismiss: () => void; onView: () => void; returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const restoreRef = useRef(true);

  useEffect(() => {
    if (!job || ref.current?.open) return;
    restoreRef.current = true;
    ref.current?.showModal();
    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }, [job]);

  if (!job) return null;
  const close = (restore = true) => {
    restoreRef.current = restore;
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className={styles.handoffDialog}
      aria-labelledby="handoff-title"
      aria-describedby="handoff-description"
      onClose={() => { onDismiss(); if (restoreRef.current) returnFocusRef.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className={styles.handoffShell}>
        <header className={styles.handoffHeading}>
          <div>
            <h2 ref={titleRef} id="handoff-title" tabIndex={-1}>Statement added</h2>
            <p className={styles.handoffFilename}>{displayStatementFilename(job.original_filename)}</p>
            <p className={styles.handoffDescription} id="handoff-description">
              {PRODUCT.name} will prepare it in the background.
            </p>
          </div>
          <IconActionButton
            aria-label="Close import explanation"
            icon="/brand/icons/x.svg"
            onClick={() => close()}
          />
        </header>
        <div className={styles.pipelineIntro}><span>What to expect</span><p>A quick preview of how {PRODUCT.name} will prepare your file.</p></div>
        <ol className={styles.pipeline} aria-label={`What ${PRODUCT.name} will do next`}>
          {stages.map(([icon, label], index) => (
            <li className={styles.pipelineStage} style={{ "--stage": index } as CSSProperties} key={label}>
              <span className={styles.pipelineIcon}><Image src={`/brand/icons/${icon}`} alt="" width={20} height={20} /></span>
              <span>{label}</span>
            </li>
          ))}
          <li className={styles.pipelinePath} aria-hidden="true" />
        </ol>
        <p className={styles.handoffBasis}>Follow the actual status in Statements.</p>
        <footer className={styles.handoffFooter}>
          <ActionButton tone="secondary" onClick={() => close()}>Close</ActionButton>
          <ActionButton onClick={() => { close(false); onView(); }}>View in Statements</ActionButton>
        </footer>
      </div>
    </dialog>
  );
}
