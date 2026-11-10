import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function useCatalog({ city, area, service, available, enabled = true }, revision) {
  const [catalog, setCatalog] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ query: '', workers: [], error: '' })
  const query = new URLSearchParams({
    city, ...(area ? { area } : {}), ...(service ? { service } : {}), ...(available ? { available: 'true' } : {}),
  }).toString()
  const key = `${query}:${attempt}:${revision}`

  useEffect(() => {
    const controller = new AbortController()
    api('/services', { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setCatalog(data) }).catch(() => {})
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    function load() {
      api(`/workers?${query}`, { signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) setState({ query: key, workers: data.workers, error: '' }) })
        .catch((error) => { if (!controller.signal.aborted) setState({ query: key, workers: [], error: error.message }) })
    }
    load()
    const timer = setInterval(() => { if (!document.hidden) load() }, 20000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [query, key, enabled])

  return { catalog, ...state, workers: enabled ? state.workers : [], loading: enabled && state.query !== key, retry: () => setAttempt((value) => value + 1) }
}
