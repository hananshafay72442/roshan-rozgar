import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function useCatalog() {
  const [state, setState] = useState({ loading: true, error: '', catalog: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const options = { signal: controller.signal }

    Promise.all([api('/services', options), api('/workers', options)])
      .then(([services, workers]) => {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: '',
            catalog: { ...services, ...workers },
          })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, error: error.message, catalog: null })
        }
      })

    return () => controller.abort()
  }, [attempt])

  function retry() {
    setState({ loading: true, error: '', catalog: null })
    setAttempt((value) => value + 1)
  }

  return { ...state, retry }
}
