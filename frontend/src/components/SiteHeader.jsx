import Icon from './Icon'

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="#" aria-label="Roshan Rozgar home">
          <span className="brand-mark"><Icon name="sun" size={25} /></span>
          <span>Roshan <span className="text-ember">Rozgar</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#workers">Find a worker</a>
          <a href="#how-it-works">How it works</a>
          <a className="nav-worker" href="#for-workers">For workers <Icon name="arrow" size={16} /></a>
        </nav>
      </div>
    </header>
  )
}
