"use client";

import { useEffect, useRef } from "react";

type PlayerHeroNameProps = {
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
  text: string;
};

function fitSingleLine(el: HTMLElement, minFontSize: number, maxFontSize: number) {
  let low = minFontSize;
  let high = maxFontSize;
  let best = maxFontSize;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    el.style.fontSize = `${mid}px`;
    if (el.scrollWidth <= el.clientWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  el.style.fontSize = `${best}px`;
}

export function PlayerHeroName({
  className,
  maxFontSize = 80,
  minFontSize = 18,
  text,
}: PlayerHeroNameProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    const update = () => fitSingleLine(heading, minFontSize, maxFontSize);
    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    const parent = heading.parentElement;
    if (parent) observer.observe(parent);

    return () => observer.disconnect();
  }, [maxFontSize, minFontSize, text]);

  return (
    <h1 ref={headingRef} className={className}>
      {text}
    </h1>
  );
}
