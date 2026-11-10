const paths = {
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  drop: 'M12 3s-7 7.2-7 12a7 7 0 0 0 14 0c0-4.8-7-12-7-12Z',
  fan: 'M12 10c-4-8 7-9 6-3-.3 2-3 4-4 4m-1 3c9 0 4 10-1 6-1.6-1.3-1.3-4.5-1-6m-1-2c-5 7-12-2-6-4 2-.7 4.6 1.2 6 2M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  hammer: 'm14 4 6 6-3 3-3-3-8 10-3-3 10-8-3-3 4-2Z',
  paint: 'M5 3h12v6H5V3Zm12 3h3v7H11v8H8v-8h3',
  tool: 'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-4 3-3-3 3-4Z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  search: 'M20 20l-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  mic: 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5ZM5 10v1a7 7 0 0 0 14 0v-1m-7 8v4m-3 0h6',
  volume: 'M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12',
  check: 'm5 12 4 4L19 6',
  shield: 'M12 22s8-4 8-11V6l-8-4-8 4v5c0 7 8 11 8 11Zm-3-11 2 2 4-4',
  star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 3Z',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  close: 'm6 6 12 12M18 6 6 18',
  left: 'M19 12H5m6-6-6 6 6 6',
  moon: 'M21 13.1A8.5 8.5 0 0 1 10.9 3a9 9 0 1 0 10.1 10.1Z',
  house: 'm3 10 9-7 9 7v10h-6v-6H9v6H3V10Z',
  phone: 'M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a12 12 0 0 1-6-6l2-2-2-5Z',
  mail: 'M3 6h18v12H3V6Zm0 1 9 6 9-6',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18m-12 5 2 2 4-4',
  chat: 'M20 11a8 8 0 0 1-8 8H4l1.8-3.6A8 8 0 1 1 20 11Zm-12 0h8m-8 3h5',
  stop: 'M7 7h10v10H7z',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
}

export default function Icon({ name, size = 22, className = '', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`${['arrow', 'left', 'chevron'].includes(name) ? 'directional-icon ' : ''}${className}`.trim()}
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name] || paths.tool} />
    </svg>
  )
}
