"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CarMark } from "@/components/brand/logo";

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (sessionStorage.getItem("anx_booted_v3")) {
        gsap.set(root.current, { autoAlpha: 0, display: "none" });
        return;
      }

      const paths = root.current?.querySelectorAll("path, circle") ?? [];
      paths.forEach((node) => {
        const el = node as SVGGeometryElement;
        if (typeof el.getTotalLength !== "function") return;
        const len = el.getTotalLength();
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => sessionStorage.setItem("anx_booted_v3", "1"),
      });

      tl.to(".preload-mark path, .preload-mark circle, .preload-mark rect", {
        strokeDashoffset: 0,
        duration: 1.15,
        stagger: 0.06,
      })
        .fromTo(".preload-word", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.45 }, "-=0.25")
        .fromTo(".preload-line", { scaleX: 0 }, { scaleX: 1, duration: 0.55, transformOrigin: "center" }, "-=0.2")
        .to(root.current, { autoAlpha: 0, duration: 0.65, delay: 0.28, ease: "power2.inOut" })
        .set(root.current, { display: "none" });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070708] text-white"
    >
      <div className="preload-mark">
        <CarMark className="h-28 w-28 md:h-36 md:w-36" draw />
      </div>
      <div className="preload-line metallic-line mt-7 h-px w-36 origin-center" />
      <p className="preload-word mt-5 text-[11px] uppercase tracking-[0.46em] text-zinc-400">Auto Nex</p>
    </div>
  );
}
