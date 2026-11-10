import { useMemo } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLanguage } from '../i18n/LanguageProvider'
import BrandMark from './BrandMark'
import GlassNavbar from './GlassNavbar/GlassNavbar'
import LanguageToggle from './LanguageToggle'

function openScrollSection(event, id) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const animation = ScrollTrigger.getById(id)
  if (!animation) return
  event.preventDefault()
  const hash = event.currentTarget.hash
  if (location.hash !== hash) history.pushState(null, '', hash)
  window.scrollTo({ top: animation.start, behavior: 'smooth' })
}

export default function SiteHeader({ user, openAuth, openWorkspace }) {
  const { t } = useLanguage()
  const links = useMemo(() => user?.role === 'admin' ? [] : user?.role === 'worker' ? [
    { href: '#account', label: t('My requests'), onClick: (event) => { event.preventDefault(); openWorkspace() } },
    { href: '#my-profile', label: t('Your public profile.') },
  ] : [
    { href: '#workers', label: t('Find a worker') },
    { href: '#services', label: t('Explore trades'), onClick: (event) => openScrollSection(event, 'trade-rail') },
    ...(!user ? [{ href: '#reviews', label: t('Reviews') },
      { href: '#how-it-works', label: t('How it works'), onClick: (event) => openScrollSection(event, 'scroll-drops') }] : []),
  ], [t, user, openWorkspace])
  const actions = useMemo(() => {
    const onClick = (callback) => (event) => { event.preventDefault(); callback() }
    return user
      ? { action: { href: '#account', label: t(user.role === 'admin' ? 'Admin review' : user.role === 'worker' ? 'Worker workspace' : 'My requests'), onClick: onClick(openWorkspace) } }
      : {
          action: { href: '#join', label: t('Get started'), onClick: onClick(() => openAuth('register')) },
          secondaryAction: { href: '#sign-in', label: t('Sign in'), onClick: onClick(() => openAuth('login')) },
        }
  }, [user, openAuth, openWorkspace, t])

  return <GlassNavbar className="roshan-navbar" brand={t('Roshan Rozgar')} brandHref="#top"
    brandIcon={<BrandMark />} links={links} menuNote={t('Skilled work, close to home.')}
    controls={<LanguageToggle />} labels={{
      home: t('Roshan Rozgar home'), navigation: t('Main navigation'), mobileNavigation: t('Mobile navigation'),
      closeNavigation: t('Close navigation'), openNavigation: t('Open navigation'), close: t('Close'), menu: t('Menu'),
    }} routeKey={user?.role} {...actions} />
}
