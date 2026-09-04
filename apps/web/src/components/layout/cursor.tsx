"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = dot.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3" });

    const move = (e: MouseEvent) => {
      xTo(e.clientX - 8);
      yTo(e.clientY - 8);
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  });

  return (
    <div
      ref={dot}
      className="pointer-events-none fixed top-0 left-0 z-[90] hidden h-4 w-4 rounded-full border border-royal/70 bg-royal/20 mix-blend-difference md:block"
    />
  );
}
