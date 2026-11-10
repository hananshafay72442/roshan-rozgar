import { BrandMark } from './SiteHeader'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <a className="brand" href="#top"><BrandMark /> Roshan Rozgar</a>
        <p>Local skills. Good work. <span lang="ur" dir="rtl">روشن روزگار</span></p>
        <nav aria-label="Footer navigation">
          <a href="#workers">Find help</a>
          <a href="#for-workers">For workers</a>
        </nav>
      </div>
    </footer>
  )
}
