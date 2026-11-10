"use client";
import { useEffect, useId, useRef, useState } from "react";
import useNavbarMotion from "./useNavbarMotion.js";
import "./GlassNavbar.css";

const defaultLinks = [
  {
    href: "#features",
    label: "Features",
    description: "A little closer to the details",
  },
  {
    href: "#story",
    label: "Our approach",
    description: "The thinking behind the work",
  },
];
const defaultAction = { href: "#contact", label: "Get in touch" };

/** Router-independent, nonmodal navigation. All motion stays inside the header. */
export default function GlassNavbar({
  brand = "Fieldwork",
  brandHref = "#",
  brandIcon,
  links = defaultLinks,
  secondaryAction,
  action = defaultAction,
  activeHref,
  controls,
  labels = {},
  overHero = true,
  menuNote = "Good things start with a conversation.",
  LinkComponent = "a",
  routeKey,
  className = "",
  style,
}) {
  const header = useRef(null);
  const toggle = useRef(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useNavbarMotion(header, { routeKey, links, action, brand });
  const close = () => setOpen(false);

  useEffect(() => {
    const frame = requestAnimationFrame(close);
    return () => cancelAnimationFrame(frame);
  }, [routeKey, activeHref]);
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 1024px)");
    const reset = () => {
      const focused = document.activeElement;
      if (header.current?.contains(focused)) {
        if (
          desktop.matches &&
          (focused === toggle.current || focused.closest(".gn-mobile"))
        ) {
          header.current.querySelector(".gn-desktop a")?.focus();
        } else if (!desktop.matches && focused.closest(".gn-desktop"))
          toggle.current?.focus();
      }
      close();
    };
    desktop.addEventListener("change", reset);
    return () => desktop.removeEventListener("change", reset);
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!header.current?.contains(event.target)) close();
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function navigation(mobile = false) {
    return links.map(({ href, label, description, active, onClick, ...props }) => (
      <LinkComponent
        {...props}
        key={href}
        href={href}
        className={`gn-link${(active ?? activeHref === href) ? " is-active" : ""}`}
        aria-current={
          (active ?? activeHref === href)
            ? href.includes("#")
              ? "location"
              : "page"
            : undefined
        }
        onClick={(event) => {
          close();
          onClick?.(event);
        }}
      >
        <span>
          {label}
          {mobile && description && <small>{description}</small>}
        </span>
        {mobile && (
          <svg
            className="gn-link-arrow"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </LinkComponent>
    ));
  }
  function actions() {
    return (
      <>
        {secondaryAction && (
          <LinkComponent
            href={secondaryAction.href}
            className="gn-signin"
            onClick={(event) => {
              close();
              secondaryAction.onClick?.(event);
            }}
          >
            <span>{secondaryAction.label}</span>
          </LinkComponent>
        )}
        {action && (
          <LinkComponent
            href={action.href}
            className="gn-cta"
            onClick={(event) => {
              close();
              action.onClick?.(event);
            }}
            onPointerEnter={(event) => {
              if (event.pointerType !== "mouse") return;
              const rect = event.currentTarget.getBoundingClientRect();
              event.currentTarget.style.setProperty(
                "--ripple-x",
                `${event.clientX - rect.left}px`,
              );
              event.currentTarget.style.setProperty(
                "--ripple-y",
                `${event.clientY - rect.top}px`,
              );
            }}
          >
            <span className="gn-button-content">
              {action.label}
              <svg
                className="directional-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 18 18 6M6 6h12v12"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </LinkComponent>
        )}
      </>
    );
  }
  return (
    <header
      ref={header}
      style={style}
      className={`glass-navbar${overHero ? " glass-navbar--hero" : ""}${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""} ${className}`}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
    >
      <div className="gn-shell gn-container">
        <div className="gn-row">
          <span className="gn-aura" aria-hidden="true">
            <span className="gn-glow gn-glow--trail" />
            <span className="gn-glow gn-glow--lead" />
            <span className="gn-glass-edge" />
          </span>
          <LinkComponent
            className="gn-brand"
            href={brandHref}
            aria-label={labels.home || `${brand} home`}
            onClick={close}
          >
            <span className="gn-brand-icon" aria-hidden="true">
              {brandIcon || (
                <svg viewBox="0 0 32 32" fill="none">
                  <path
                    d="M16 7v18M9 12c0 6 7 6 7 6s0-6-7-6Zm14-3c0 6-7 7-7 7s0-6 7-7ZM9 19c0 5 7 5 7 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span>{brand}</span>
          </LinkComponent>
          <nav className="gn-desktop gn-primary" aria-label={labels.navigation || "Main navigation"}>
            <span className="gn-hover" aria-hidden="true" />
            {navigation()}
          </nav>
          <div className="gn-desktop gn-actions">{actions()}</div>
          {controls}
          <button
            ref={toggle}
            className="gn-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? labels.closeNavigation || "Close navigation" : labels.openNavigation || "Open navigation"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="gn-toggle-label">{open ? labels.close || "Close" : labels.menu || "Menu"}</span>
            <span className="gn-toggle-icon" aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
        <div
          className="gn-mobile"
          id={menuId}
          inert={!open}
          aria-hidden={!open}
        >
          <div className="gn-mobile-content">
            <nav aria-label={labels.mobileNavigation || "Mobile navigation"}>{navigation(true)}</nav>
            {(action || secondaryAction) && (
              <div className="gn-mobile-actions">{actions()}</div>
            )}
            {menuNote && <p className="gn-mobile-note">{menuNote}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}
