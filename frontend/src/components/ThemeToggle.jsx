import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from './Icon'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const inFlight = useRef(false)

  function toggle(event) {
    if (inFlight.current) return
    const root = document.documentElement
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const nextTheme = dark ? 'light' : 'dark'

    function apply() {
      root.dataset.theme = nextTheme
      try { localStorage.setItem('roshan-theme', nextTheme) } catch { /* optional persistence */ }
      flushSync(() => setDark(nextTheme === 'dark'))
    }

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply()
      return
    }
    if (!document.startViewTransition) {
      const pulse = document.createElement('span')
      pulse.className = 'theme-pulse'
      pulse.style.setProperty('--pulse-x', `${x}px`)
      pulse.style.setProperty('--pulse-y', `${y}px`)
      document.body.append(pulse)
      pulse.addEventListener('animationend', () => pulse.remove(), { once: true })
      apply()
      return
    }

    inFlight.current = true
    const transition = document.startViewTransition(apply)
    transition.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 620, easing: 'cubic-bezier(.24,.64,.25,1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {})
    transition.finished.catch(() => {}).finally(() => { inFlight.current = false })
  }

  return (
    <button className="theme-toggle" type="button" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'} onClick={toggle}>
      <Icon name={dark ? 'sun' : 'moon'} size={22} />
    </button>
  )
}
