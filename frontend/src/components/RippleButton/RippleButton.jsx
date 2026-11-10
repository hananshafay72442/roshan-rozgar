import "./RippleButton.css";

function setRippleOrigin(button, x, y, width, height) {
  const horizontal = Math.max(x, width - x);
  const vertical = Math.max(y, height - y);
  const diameter = Math.hypot(horizontal, vertical) * 2;

  button.style.setProperty("--ripple-x", `${x}px`);
  button.style.setProperty("--ripple-y", `${y}px`);
  button.style.setProperty("--ripple-size", `${diameter}px`);
}

function trackPointer(event) {
  const button = event.currentTarget;
  const { left, top, width, height } = button.getBoundingClientRect();
  setRippleOrigin(button, event.clientX - left, event.clientY - top, width, height);
}

export default function RippleButton({
  children,
  showArrow = true,
  className = "",
  type = "button",
  href,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  ...props
}) {
  const Element = href ? "a" : "button";
  return (
    <Element
      {...props}
      className={`ripple-button ${className}`.trim()}
      type={href ? undefined : type}
      href={href}
      onPointerEnter={(event) => {
        trackPointer(event);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        trackPointer(event);
        onPointerLeave?.(event);
      }}
      onFocus={(event) => {
        const button = event.currentTarget;
        if (button.matches(":focus-visible")) {
          const { width, height } = button.getBoundingClientRect();
          setRippleOrigin(button, width / 2, height / 2, width, height);
        }
        onFocus?.(event);
      }}
    >
      <span className="ripple-button__fill" aria-hidden="true" />
      <span className="ripple-button__label">
        {children}
        {showArrow && (
          <svg className="directional-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8h9M8.5 3.5 13 8l-4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </Element>
  );
}
