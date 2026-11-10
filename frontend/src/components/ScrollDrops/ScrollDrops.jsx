"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "./ScrollDrops.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// A repeatable layout prevents hydration mismatches and jumps on re-render.
function createDrops(count, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  return Array.from({ length: count }, (_, id) => {
    const depth = random();
    const size = 0.1 + depth * 1.9;

    return {
      id,
      size,
      top: random() * 200,
      left: random() * (100 - size),
      opacity: 0.1 + depth * 0.8,
      stretch: 1 + depth * 8,
    };
  });
}

/**
 * Scroll-linked gradient drops. Optional children stay above the background.
 * The section supplies two viewport heights of scroll space automatically.
 */
export default function ScrollDrops({
  children,
  count = 40,
  seed = 11,
  className = "",
  style,
  ...sectionProps
}) {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const safeCount = Number.isFinite(count)
    ? Math.min(160, Math.max(0, Math.floor(count)))
    : 40;
  const drops = useMemo(() => createDrops(safeCount, seed), [safeCount, seed]);

  useGSAP(
    () => {
      const elements = sectionRef.current.querySelectorAll(".scroll-drops__drop");
      if (!elements.length) return;

      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Position, stretching, and fading share one reversible timeline.
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 90%",
            end: "bottom bottom",
            scrub: 1,
            invalidateOnRefresh: true,
          },
          defaults: { ease: "power2.inOut", stagger: 0.008 },
        });

        timeline.fromTo(
          elements,
          { y: 0, "--drop-stretch": 1 },
          {
            y: () => -stageRef.current.clientHeight,
            "--drop-stretch": (index) => drops[index].stretch,
            duration: 1,
          },
          0,
        );

        timeline.fromTo(
          elements,
          { opacity: 1 },
          { opacity: 0, duration: 0.5, immediateRender: false },
          0.5,
        );

        // Recalculate travel when a containing layout changes the stage height.
        let height = stageRef.current.clientHeight;
        let refreshFrame;
        const observer = new ResizeObserver(() => {
          const nextHeight = stageRef.current?.clientHeight;
          if (!nextHeight || nextHeight === height) return;
          height = nextHeight;
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
        });
        observer.observe(stageRef.current);

        return () => {
          observer.disconnect();
          cancelAnimationFrame(refreshFrame);
        };
      });

      return () => media.revert();
    },
    { scope: sectionRef, dependencies: [drops], revertOnUpdate: true },
  );

  return (
    <section
      {...sectionProps}
      ref={sectionRef}
      className={`scroll-drops ${className}`.trim()}
      style={style}
    >
      <div ref={stageRef} className="scroll-drops__stage">
        <div className="scroll-drops__field" aria-hidden="true">
          {drops.map((drop) => (
            <span
              key={drop.id}
              className="scroll-drops__drop"
              style={{
                top: `${drop.top}%`,
                left: `${drop.left}%`,
                width: `${drop.size}%`,
                "--drop-opacity": drop.opacity,
              }}
            >
              <span className="scroll-drops__color" />
            </span>
          ))}
        </div>
        {children != null && <div className="scroll-drops__content">{children}</div>}
      </div>
    </section>
  );
}
