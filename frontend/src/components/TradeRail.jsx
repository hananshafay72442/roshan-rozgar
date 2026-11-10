import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useLanguage } from '../i18n/LanguageProvider'
import Icon from './Icon'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const trades = {
  electrician: {
    description: 'Wiring, lights and sockets',
    art: 'M41 25h38a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7H41a7 7 0 0 1-7-7V32a7 7 0 0 1 7-7Zm11 12v8m16-8v8m-10 8h4M60 25V15H22m64 36h15V28h10',
  },
  plumber: {
    description: 'Leaks, taps and drains',
    art: 'M25 18v25c0 15 10 24 24 24s25-9 25-24V34h21v-9H64v18c0 9-6 14-15 14s-14-5-14-14V18m-14 0h18m34 1V9m-10 0h20m12 33s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z',
  },
  'ac-technician': {
    description: 'AC repair and servicing',
    art: 'M29 18h67a6 6 0 0 1 6 6v17a6 6 0 0 1-6 6H29a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6Zm0 19h67m-11-9h9M43 54c-8 7 7 11 0 18m19-18c-8 7 7 11 0 18m19-18c-8 7 7 11 0 18',
  },
  carpenter: {
    description: 'Doors, shelves and furniture',
    art: 'M21 56h80v11H21Zm15 5h15m18 0h16M28 42l52-24 6 13-8 4-1 7-6-3-4 7-5-3-5 7-5-3-5 6-6-3-8 4-5-12Zm52-24 12-6a6 6 0 0 1 8 3l3 6a6 6 0 0 1-3 8l-14 2',
  },
  painter: {
    description: 'Walls, ceilings and touch-ups',
    art: 'M23 18h63v19H23Zm63 10h13v16H61v10m-5 0h10v16H56Zm-24-30h44m-39 22v12m-10-5v9',
  },
  mechanic: {
    description: 'Cars, bikes and repairs',
    art: 'M83 18a19 19 0 0 0-23 24L35 62a7 7 0 0 0 9 11l25-23a19 19 0 0 0 24-23l-11 10-10-9 11-10Zm-43 49h1M29 19l8-4 8 4v9l-8 4-8-4v-9Zm8 3h.1m63 28 5 8-5 8h-9l-5-8 5-8h9Zm-5 8h.1',
  },
}

export default function TradeRail({ services, selected, onSelect }) {
  const { locale, t } = useLanguage()
  const section = useRef(null)
  const heading = useRef(null)
  const inner = useRef(null)
  const rail = useRef(null)
  const pin = useRef(null)
  const direction = locale.dir === 'rtl' ? -1 : 1

  useGSAP(() => {
    const viewport = rail.current
    const travel = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const media = gsap.matchMedia()

    media.add('(min-height: 600px) and (prefers-reduced-motion: no-preference)', () => {
      if (travel() < 8) return
      const trigger = ScrollTrigger.create({
        id: 'trade-rail',
        trigger: heading.current,
        pin: inner.current,
        start: 'center center',
        end: () => `+=${Math.max(1, Math.round(travel() * .86))}`,
        refreshPriority: 1,
        onUpdate: ({ progress }) => { viewport.scrollLeft = direction * progress * travel() },
      })
      pin.current = trigger
      return () => { pin.current = null }
    })

    let frame
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    observer.observe(heading.current)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      media.revert()
    }
  }, { scope: section, dependencies: [services.length, direction], revertOnUpdate: true })

  function move(stepDirection) {
    const viewport = rail.current
    const step = (viewport.firstElementChild?.getBoundingClientRect().width || 250) + 16
    const travel = viewport.scrollWidth - viewport.clientWidth
    if (travel < 1) return
    const next = Math.max(0, Math.min(travel, Math.abs(viewport.scrollLeft) + stepDirection * step))
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    const trigger = pin.current
    if (trigger && window.scrollY <= trigger.end + 1) {
      const { start, end } = trigger
      window.scrollTo({ top: start + (next / travel) * (end - start), behavior })
    } else {
      viewport.scrollTo({ left: direction * next, behavior })
    }
  }

  return (
    <section className="trade-section" id="services" ref={section} aria-labelledby="trades-title">
      <div className="container trade-inner" ref={inner}>
        <div className="section-heading trade-heading">
          <div><p className="eyebrow">01 <span /> {t('Explore the trades')}</p><h2 id="trades-title" ref={heading}>{t('What needs fixing?')}</h2></div>
          <div className="rail-controls">
            <button type="button" className="icon-button" aria-label={t('Previous trades')} onClick={() => move(-1)}><Icon name="left" size={19} /></button>
            <button type="button" className="icon-button" aria-label={t('Next trades')} onClick={() => move(1)}><Icon name="arrow" size={19} /></button>
          </div>
        </div>
        <div className="trade-rail" ref={rail} dir={locale.dir} aria-label={t('Trade categories')}>
          {services.map((service, index) => {
            const { description, art } = trades[service.id] || {}
            return (
              <button type="button" className="trade-tile" aria-pressed={selected === service.id} key={service.id} onClick={() => onSelect(service.id)}>
                <span className="tile-picture" aria-hidden="true">
                  <span className="tile-index">{String(index + 1).padStart(2, '0')}</span>
                  <svg viewBox="0 0 128 80" fill="none"><path d={art} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="tile-label">
                  <strong>{t(service.name)}</strong>
                  {description && <small>{t(description)}</small>}
                </span>
                <span className="tile-arrow"><Icon name="arrow" size={17} /></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
