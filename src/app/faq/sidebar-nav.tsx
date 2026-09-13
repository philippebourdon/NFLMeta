"use client";

import { useState } from "react";
import styles from "./page.module.css";

type SidebarItem = {
  id: string;
  question: string;
};

type SidebarSection = {
  id: string;
  title: string;
  items: SidebarItem[];
};

export function FaqSidebarNav({ sections }: { sections: SidebarSection[] }) {
  const [openSectionId, setOpenSectionId] = useState<string>(sections[0]?.id ?? "");

  return (
    <div className={styles.groupList}>
      {sections.map((section) => {
        const isOpen = section.id === openSectionId;
        return (
          <div key={section.id} className={styles.group} data-open={isOpen ? "true" : "false"}>
            <button
              type="button"
              className={styles.groupToggle}
              aria-expanded={isOpen}
              aria-controls={`faq-group-${section.id}`}
              onClick={() => setOpenSectionId(isOpen ? "" : section.id)}
            >
              <span>{section.title}</span>
            </button>
            {isOpen ? (
              <ul id={`faq-group-${section.id}`} className={styles.groupItems}>
                <li>
                  <a href={`#${section.id}`} className={styles.groupSectionLink}>
                    Jump to section
                  </a>
                </li>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.question}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
