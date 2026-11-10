const paths = {
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  drop: 'M12 3s-7 7.2-7 12a7 7 0 0 0 14 0c0-4.8-7-12-7-12Z',
  fan: 'M12 10c-4-8 7-9 6-3-.3 2-3 4-4 4m-1 3c9 0 4 10-1 6-1.6-1.3-1.3-4.5-1-6m-1-2c-5 7-12-2-6-4 2-.7 4.6 1.2 6 2M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  hammer: 'm14 4 6 6-3 3-3-3-8 10-3-3 10-8-3-3 4-2Z',
  paint: 'M5 3h12v6H5V3Zm12 3h3v7H11v8H8v-8h3',
  tool: 'M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-4 3-3-3 3-4Z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
}

export default function Icon({ name, size = 22, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name] || paths.tool} />
    </svg>
  )
}
