import { useLanguage } from '../i18n/LanguageProvider'
import BrandMark from './BrandMark'

export default function SiteFooter({ user, openWorkspace }) {
  const { t } = useLanguage()
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <a className="brand" href="#top"><BrandMark /> {t('Roshan Rozgar')}</a>
        <p>{t('Local skills. Good work.')}</p>
        <nav aria-label={t('Footer navigation')}>
          <a href="#workers">{t('Find help')}</a>
          {user ? <button type="button" className="text-button" onClick={openWorkspace}>{t('Open my workspace')}</button>
            : <a href="#for-workers">{t('For workers')}</a>}
        </nav>
      </div>
    </footer>
  )
}
