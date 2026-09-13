"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.copyButton} onClick={onCopy}>
      {copied ? "Copied" : "Copy Key"}
    </button>
  );
}
