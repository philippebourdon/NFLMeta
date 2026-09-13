"use client";

import { useRef } from "react";
import styles from "./page.module.css";

export default function PlayerHeadshotOverlayUpload({
  action,
}: {
  action: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      ref={formRef}
      action={action}
      method="post"
      encType="multipart/form-data"
      className={styles.headshotUploadForm}
    >
      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept="image/png,image/jpeg,image/webp"
        required
        style={{ display: "none" }}
        onChange={() => {
          if (inputRef.current?.files?.length) {
            formRef.current?.requestSubmit();
          }
        }}
      />
      <button
        type="button"
        className={styles.headshotUploadButton}
        aria-label="Upload player headshot"
        title="Upload player headshot"
        onClick={() => inputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20l4.5-1 9-9a1.8 1.8 0 0 0 0-2.6l-1.9-1.9a1.8 1.8 0 0 0-2.6 0l-9 9L3 19.9z" />
          <path d="M12.5 6.5l5 5" />
        </svg>
      </button>
    </form>
  );
}
