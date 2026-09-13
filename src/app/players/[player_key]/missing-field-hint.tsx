"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

export type EditablePlayerFieldKey =
  | "position"
  | "latest_team_abbr"
  | "college_name"
  | "years_of_experience"
  | "jersey_number"
  | "draft_year"
  | "birth_date"
  | "birth_place"
  | "height_in"
  | "weight_lb"
  | "position_group"
  | "rookie_season"
  | "last_season"
  | "draft_round"
  | "draft_pick"
  | "draft_team";

type MissingFieldHintProps = {
  playerKey: string;
  fieldKey: EditablePlayerFieldKey;
  fieldLabel: string;
};

function inputMeta(fieldKey: EditablePlayerFieldKey): {
  type: "text" | "number" | "date";
  placeholder: string;
} {
  switch (fieldKey) {
    case "birth_date":
      return { type: "date", placeholder: "YYYY-MM-DD" };
    case "height_in":
      return { type: "text", placeholder: `74 or 6'2"` };
    case "years_of_experience":
    case "draft_year":
    case "weight_lb":
    case "rookie_season":
    case "last_season":
    case "draft_round":
    case "draft_pick":
      return { type: "number", placeholder: "Enter value" };
    case "jersey_number":
      return { type: "text", placeholder: "88" };
    case "draft_team":
    case "latest_team_abbr":
      return { type: "text", placeholder: "ARI" };
    default:
      return { type: "text", placeholder: "Enter value" };
  }
}

export default function MissingFieldHint({
  playerKey,
  fieldKey,
  fieldLabel,
}: MissingFieldHintProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = useMemo(() => inputMeta(fieldKey), [fieldKey]);

  async function onSave() {
    if (!value.trim()) {
      setError("Enter a value");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/players/${encodeURIComponent(playerKey)}/update-field`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fieldKey,
          value,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Save failed");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Save failed");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={styles.missingFieldHint}
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        aria-label={`Update ${fieldLabel}`}
        title={`Update ${fieldLabel}`}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20l4.5-1 9-9a1.8 1.8 0 0 0 0-2.6l-1.9-1.9a1.8 1.8 0 0 0-2.6 0l-9 9L3 19.9z" />
          <path d="M12.5 6.5l5 5" />
        </svg>
        <span>Update Field</span>
      </button>
    );
  }

  return (
    <span className={styles.missingFieldEditor}>
      <input
        id="missing-field-hint-input"
        autoFocus
        className={styles.missingFieldInput}
        type={meta.type}
        placeholder={meta.placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onSave();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setValue("");
            setError(null);
          }
        }}
      />
      <button type="button" className={styles.missingFieldSave} disabled={saving} onClick={() => void onSave()}>
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        className={styles.missingFieldCancel}
        disabled={saving}
        onClick={() => {
          setOpen(false);
          setValue("");
          setError(null);
        }}
      >
        Cancel
      </button>
      {error ? <span className={styles.missingFieldError}>{error}</span> : null}
    </span>
  );
}
