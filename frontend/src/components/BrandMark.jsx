export default function BrandMark({ className = '' }) {
  return <img className={`brand-mark ${className}`.trim()} src="/favicon.svg" alt="" width="40" height="40" />
}
