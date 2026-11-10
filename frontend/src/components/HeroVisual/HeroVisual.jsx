import { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import BrandMark from '../BrandMark';
import electricianPhoto from '../../assets/roshan-electrician.webp';
import './HeroVisual.css';

/** Original morphing blob, illustration, floating cards, and pointer movement. */
export default function HeroVisual({
  className = '',
  imageSrc = electricianPhoto,
  imageAlt = 'Electrician using a screwdriver at an electrical panel',
  ...props
}) {
  const { t } = useLanguage();
  const rootRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    // Track across the containing hero when provided, just like the source.
    const pointerArea = root.closest('[data-hero-pointer-area], #hero') || root;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId = 0;
    let currentX = 0;
    let currentY = 0;
    let currentRotation = 0;
    let targetX = 0;
    let targetY = 0;
    let targetRotation = 0;

    function handlePointerMove(event) {
      if (motionPreference.matches || event.pointerType === 'touch') return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = Math.max(-1, Math.min(1,
        (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
      const dy = Math.max(-1, Math.min(1,
        (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
      targetX = dx * 10;
      targetY = dy * 10;
      targetRotation = dx * 0.65;
      startAnimation();
    }

    function handlePointerLeave() {
      targetX = targetY = targetRotation = 0;
      startAnimation();
    }

    function startAnimation() {
      if (!frameId && !motionPreference.matches) frameId = requestAnimationFrame(animate);
    }

    function animate() {
      frameId = 0;
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      currentRotation += (targetRotation - currentRotation) * 0.1;
      stage.style.transform =
        `translate(${currentX}px, ${currentY}px) rotate(${currentRotation}deg)`;
      if (Math.abs(currentX - targetX) + Math.abs(currentY - targetY) + Math.abs(currentRotation - targetRotation) > 0.02) {
        startAnimation();
      }
    }

    function syncMotionPreference() {
      window.cancelAnimationFrame(frameId);
      currentX = currentY = currentRotation = 0;
      targetX = targetY = targetRotation = 0;
      frameId = 0;
      stage.style.removeProperty('transform');
    }

    pointerArea.addEventListener('pointermove', handlePointerMove);
    pointerArea.addEventListener('pointerleave', handlePointerLeave);
    motionPreference.addEventListener('change', syncMotionPreference);
    syncMotionPreference();

    // Clean up for unmounting and React StrictMode's effect replay.
    return () => {
      window.cancelAnimationFrame(frameId);
      pointerArea.removeEventListener('pointermove', handlePointerMove);
      pointerArea.removeEventListener('pointerleave', handlePointerLeave);
      motionPreference.removeEventListener('change', syncMotionPreference);
      stage.style.removeProperty('transform');
    };
  }, []);

  return (
    <div {...props} ref={rootRef} className={`hero-visual ${className}`.trim()}>
      <div ref={stageRef} className="visual-stage">
        <div className="visual-halo" aria-hidden="true" />
        <figure className="visual-photo">
          <img src={imageSrc} alt={t(imageAlt)} width="1500" height="1125" fetchPriority="high" />
          <figcaption><span>01 / {t('The trades')}</span><strong>{t('Electrician')}</strong></figcaption>
        </figure>
        <BrandMark className="visual-index" />
      </div>
    </div>
  );
}
