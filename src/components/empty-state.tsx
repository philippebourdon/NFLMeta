import Link from "next/link";
import { UiImage } from "@/components/ui-image";
import styles from "./empty-state.module.css";

type EmptyStateAction = {
  href: string;
  label: string;
  primary?: boolean;
};

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  message: string;
  compact?: boolean;
  actions?: EmptyStateAction[];
};

export function EmptyState({ eyebrow, title, message, compact = false, actions = [] }: EmptyStateProps) {
  return (
    <section className={`${styles.card}${compact ? ` ${styles.compact}` : ""}`}>
      <div className={styles.topline}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <UiImage src="/brand/nfl-shield.png" alt="NFL Shield" className={styles.shield} width={42} height={51} loading="lazy" />
      </div>
      <div className={styles.brand}>
        <UiImage src="/hero_main/NFLMeta_Logo.png" alt="NFLMeta" className={styles.logo} width={715} height={126} loading="lazy" />
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {actions.length ? (
        <div className={styles.actions}>
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={action.primary ? styles.primaryAction : styles.secondaryAction}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
