import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Icon from './Icon'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export default function TradeRail({ services, selected, onSelect }) {
  const section = useRef(null)
  const inner = useRef(null)
  const rail = useRef(null)
  const pin = useRef(null)

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)', () => {
      const viewport = rail.current
      const travel = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      if (travel() < 8) return
      const trigger = ScrollTrigger.create({
        trigger: section.current, pin: inner.current,
        start: 'top top+=100', end: () => `+=${travel() * .85}`, invalidateOnRefresh: true,
        onUpdate: (self) => { viewport.scrollLeft = self.progress * travel() },
      })
      pin.current = trigger
      return () => { pin.current = null }
    })
    return () => media.revert()
  }, { scope: section, dependencies: [services.length], revertOnUpdate: true })

  function move(direction) {
    const viewport = rail.current
    const step = (viewport.firstElementChild?.getBoundingClientRect().width || 250) + 16
    const end = viewport.scrollWidth - viewport.clientWidth
    if (end < 1) return
    const next = Math.max(0, Math.min(end, viewport.scrollLeft + direction * step))
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    if (pin.current?.isActive) {
      const { start, end: scrollEnd } = pin.current
      window.scrollTo({ top: start + (next / end) * (scrollEnd - start), behavior: smooth ? 'smooth' : 'instant' })
    } else {
      viewport.scrollTo({ left: next, behavior: smooth ? 'smooth' : 'instant' })
    }
  }

  return (
    <section className="trade-section" id="services" ref={section} aria-labelledby="trades-title">
      <div className="container trade-inner" ref={inner}>
        <div className="section-heading trade-heading">
          <div><p className="eyebrow">01 <span /> Explore the trades</p><h2 id="trades-title">What needs fixing?</h2></div>
          <div className="rail-controls">
            <button type="button" className="icon-button" aria-label="Previous trades" onClick={() => move(-1)}><Icon name="left" size={19} /></button>
            <button type="button" className="icon-button" aria-label="Next trades" onClick={() => move(1)}><Icon name="arrow" size={19} /></button>
          </div>
        </div>
        <div className="trade-rail" ref={rail} aria-label="Trade categories">
          {services.map((service, index) => (
            <button type="button" className="trade-tile" aria-pressed={selected === service.id} key={service.id} onClick={() => onSelect(service.id)}>
              <span className="tile-index" aria-hidden="true">0{index + 1}</span>
              <span className="tile-art"><Icon name={service.icon} size={63} /></span>
              <span className="tile-label">
                <strong>{service.name}</strong>
                <span lang="ur" dir="rtl">{service.urdu}</span>
              </span>
              <Icon className="tile-arrow" name="arrow" size={19} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
