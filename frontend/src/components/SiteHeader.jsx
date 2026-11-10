import { useMemo } from 'react'
import Icon from './Icon'
import GlassNavbar from './GlassNavbar/GlassNavbar'

const links = [
  { href: '#workers', label: 'Find a worker' },
  { href: '#services', label: 'Explore trades' },
  { href: '#how-it-works', label: 'How it works' },
]

export function BrandMark() {
  return <span className="brand-mark"><Icon name="sun" size={22} /></span>
}

export default function SiteHeader({ user, openAuth, openWorkspace }) {
  const actions = useMemo(() => {
    const onClick = (callback) => (event) => { event.preventDefault(); callback() }
    return user
      ? { action: { href: '#account', label: user.role === 'worker' ? 'Worker workspace' : 'My requests', onClick: onClick(openWorkspace) } }
      : {
          action: { href: '#join', label: 'Get started', onClick: onClick(() => openAuth('register')) },
          secondaryAction: { href: '#sign-in', label: 'Sign in', onClick: onClick(() => openAuth('login')) },
        }
  }, [user, openAuth, openWorkspace])

  return <GlassNavbar className="roshan-navbar" brand="Roshan Rozgar" brandHref="#top"
    brandIcon={<BrandMark />} links={links} menuNote="Skilled work, close to home."
    routeKey={user?.role} {...actions} />
}
