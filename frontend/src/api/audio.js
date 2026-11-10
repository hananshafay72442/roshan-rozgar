// A short mono WAV works across the audio formats accepted by Gemini.
export async function profileAudio(blob) {
  if (blob.type === 'audio/wav') return blob
  const Audio = window.AudioContext || window.webkitAudioContext
  if (!Audio || !window.OfflineAudioContext) throw new Error('This browser can’t prepare a recording for profile setup.')

  const context = new Audio()
  let decoded
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await context.close()
  }
  const rate = 16000
  const frames = Math.ceil(Math.min(decoded.duration, 30) * rate)
  const mono = new OfflineAudioContext(1, frames, rate)
  const source = mono.createBufferSource()
  source.buffer = decoded
  source.connect(mono.destination)
  source.start()
  const samples = (await mono.startRendering()).getChannelData(0)
  const buffer = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(buffer)
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * 2, true)
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true))
  return new Blob([buffer], { type: 'audio/wav' })
}
