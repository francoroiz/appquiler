'use client'
import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  id?: string
}

function toDisplay(raw: string): string {
  if (!raw) return ''
  const clean = raw.replace(/[^\d,]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  if (isNaN(n)) return raw
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toRaw(display: string): string {
  // es-AR: dots = thousands, comma = decimal
  return display.replace(/\./g, '').replace(',', '.')
}

export default function MontoInput({ value, onChange, placeholder = '0', id }: Props) {
  const [display, setDisplay] = useState(() => toDisplay(value))

  useEffect(() => {
    // Keep display in sync when value changes externally (e.g. when editing)
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    // Allow digits, dots (thousands), commas (decimal)
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

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  )
}
