import { useEffect } from "react";
import { gsap } from "gsap";

/** All animation targets and pointer listeners live inside this header. */
export default function useNavbarMotion(
  header,
  { routeKey, links, action, brand },
) {
  useEffect(() => {
    const root = header.current;
    if (!root) return;
    const media = gsap.matchMedia();

    media.add(
      "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (forced-colors: none) and (prefers-reduced-motion: no-preference)",
      () => {
        const row = root.querySelector(".gn-row");
        const primary = root.querySelector(".gn-primary");
        const aura = row.querySelector(".gn-aura");
        const lead = row.querySelector(".gn-glow--lead");
        const trail = row.querySelector(".gn-glow--trail");
        const pill = primary.querySelector(".gn-hover");
        const controls = new Map();
        let activeControl = null;
        let activeLink = null;
        let frame = 0;
        let pointer = null;

        gsap.set([lead, trail], { xPercent: -50, yPercent: -50 });
        const leadX = gsap.quickTo(lead, "x", {
          duration: 0.28,
          ease: "power3.out",
        });
        const leadY = gsap.quickTo(lead, "y", {
          duration: 0.28,
          ease: "power3.out",
        });
        const trailX = gsap.quickTo(trail, "x", {
          duration: 0.75,
          ease: "power3.out",
        });
        const trailY = gsap.quickTo(trail, "y", {
          duration: 0.75,
          ease: "power3.out",
        });
        const glowOpacity = gsap.quickTo(aura, "opacity", {
          duration: 0.35,
          ease: "power2.out",
        });
        const pillX = gsap.quickTo(pill, "x", {
          duration: 0.65,
          ease: "elastic.out(1, .65)",
        });
        const pillY = gsap.quickTo(pill, "y", {
          duration: 0.4,
          ease: "power3.out",
        });
        const pillWidth = gsap.quickTo(pill, "width", {
          duration: 0.5,
          ease: "power3.out",
        });
        const pillHeight = gsap.quickTo(pill, "height", {
          duration: 0.4,
          ease: "power3.out",
        });
        const pillOpacity = gsap.quickTo(pill, "opacity", {
          duration: 0.18,
          ease: "power2.out",
        });

        row
          .querySelectorAll(
            ".gn-primary .gn-link > span, .gn-signin > span, .gn-cta .gn-button-content, .gn-signout .gn-control-content, .gn-brand > span",
          )
          .forEach((content) => {
            const target = content.closest("a, button");
            controls.set(target, {
              x: gsap.quickTo(content, "x", {
                duration: 0.5,
                ease: "power3.out",
              }),
              y: gsap.quickTo(content, "y", {
                duration: 0.5,
                ease: "power3.out",
              }),
              rotation: gsap.quickTo(content, "rotation", {
                duration: 0.6,
                ease: "power3.out",
              }),
            });
          });

        function resetControl() {
          if (!activeControl) return;
          activeControl.x(0);
          activeControl.y(0);
          activeControl.rotation(0);
          activeControl = null;
        }

        function paint() {
          frame = 0;
          if (!pointer) return;
          const bounds = row.getBoundingClientRect();
          const x = pointer.x - bounds.left;
          const y = pointer.y - bounds.top;
          leadX(x);
          leadY(y);
          trailX(x);
          trailY(y);
          row.style.setProperty("--gn-pointer-x", `${x}px`);
          row.style.setProperty("--gn-pointer-y", `${y}px`);
          glowOpacity(1);

          const target = pointer.target?.closest("a, button");
          const control = controls.get(target);
          if (activeControl !== control) {
            resetControl();
            activeControl = control || null;
          }
          if (control) {
            // Only the content moves; the link's hit area stays exactly in place.
            const rect = target.getBoundingClientRect();
            const dx = gsap.utils.clamp(
              -0.5,
              0.5,
              (pointer.x - rect.left) / rect.width - 0.5,
            );
            const dy = gsap.utils.clamp(
              -0.5,
              0.5,
              (pointer.y - rect.top) / rect.height - 0.5,
            );
            control.x(dx * 10);
            control.y(dy * 7);
            control.rotation(dx * 2);
          }

          const link =
            target?.classList.contains("gn-link") &&
            primary.contains(target)
              ? target
              : null;
          if (link !== activeLink) {
            activeLink = link;
            if (link) {
              pillX(link.offsetLeft);
              pillY(link.offsetTop);
              pillWidth(link.offsetWidth);
              pillHeight(link.offsetHeight);
              pillOpacity(1);
            } else {
              pillOpacity(0);
            }
          }
        }

        function move(event) {
          if (event.pointerType !== "mouse") return;
          pointer = {
            x: event.clientX,
            y: event.clientY,
            target: event.target,
          };
          if (!frame) frame = requestAnimationFrame(paint);
        }

        function leave() {
          cancelAnimationFrame(frame);
          frame = 0;
          pointer = null;
          activeLink = null;
          resetControl();
          glowOpacity(0);
          pillOpacity(0);
        }

        root.dataset.navMotion = "on";
        row.addEventListener("pointermove", move, { passive: true });
        row.addEventListener("pointerleave", leave);
        row.addEventListener("pointercancel", leave);
        row.addEventListener("focusin", leave);
        return () => {
          cancelAnimationFrame(frame);
          row.removeEventListener("pointermove", move);
          row.removeEventListener("pointerleave", leave);
          row.removeEventListener("pointercancel", leave);
          row.removeEventListener("focusin", leave);
          row.style.removeProperty("--gn-pointer-x");
          row.style.removeProperty("--gn-pointer-y");
          delete root.dataset.navMotion;
        };
      },
    );

    // Reverts every scoped GSAP tween and inline style, including on media changes.
    return () => media.revert();
  }, [header, routeKey, links, action, brand]);
}
