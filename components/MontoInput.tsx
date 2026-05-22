'use client'
import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  id?: string
  prefix?: string
}

function toDisplay(raw: string): string {
  if (!raw) return ''
  const n = parseFloat(raw)
  if (isNaN(n)) return raw
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toRaw(display: string): string {
  // es-AR: dots = thousands, comma = decimal
  return display.replace(/\./g, '').replace(',', '.')
}

export default function MontoInput({ value, onChange, placeholder = '0', id, prefix }: Props) {
  const [display, setDisplay] = useState(() => toDisplay(value))

  useEffect(() => {
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    const filtered = val.replace(/[^\d.,]/g, '')
    setDisplay(filtered)
    const raw = toRaw(filtered)
    if (filtered === '' || !isNaN(parseFloat(raw))) {
      onChange(filtered === '' ? '' : raw)
    }
  }

  function handleBlur() {
    setDisplay(toDisplay(value))
  }

  const input = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={prefix ? { paddingLeft: 22 } : undefined}
    />
  )

  if (!prefix) return input
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14, pointerEvents: 'none', zIndex: 1 }}>{prefix}</span>
      {input}
    </div>
  )
}
