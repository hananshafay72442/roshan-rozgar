import { useLanguage } from '../i18n/LanguageProvider'
import BrandMark from './BrandMark'

export default function SiteFooter() {
  const { t } = useLanguage()
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <a className="brand" href="#top"><BrandMark /> {t('Roshan Rozgar')}</a>
        <p>{t('Local skills. Good work.')}</p>
        <nav aria-label={t('Footer navigation')}>
          <a href="#workers">{t('Find help')}</a>
          <a href="#for-workers">{t('For workers')}</a>
        </nav>
      </div>
    </footer>
  )
}
