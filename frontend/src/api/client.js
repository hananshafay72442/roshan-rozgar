export async function api(path, { signal } = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Cannot reach the service. Please try again shortly.')
  }
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.')
  }
  return data
}
