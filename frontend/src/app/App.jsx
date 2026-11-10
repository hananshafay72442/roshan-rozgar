import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import HomePage from '../pages/HomePage'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <HomePage />
      <SiteFooter />
    </>
  )
}
