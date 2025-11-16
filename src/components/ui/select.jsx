import React, { useState, useContext, createContext, useEffect, useRef } from 'react'

const SelectContext = createContext(null)

export function Select({ children, value, onValueChange }) {
  const [val, setVal] = useState(value || '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // keep internal state in sync when controlled value changes
    if (value !== undefined) setVal(value)
  }, [value])

  const handleChange = (newVal) => {
    setVal(newVal)
    onValueChange && onValueChange(newVal)
    setOpen(false)
  }

  return (
    <SelectContext.Provider value={{ val, open, setOpen, handleChange }}>
      <div ref={containerRef}>{children}</div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ children, className = '', ...props }) {
  const ctx = useContext(SelectContext)
  return (
    <div
      className={`border rounded-lg h-10 px-3 flex items-center justify-between cursor-pointer ${className}`}
      onClick={() => ctx?.setOpen(!ctx?.open)}
      {...props}
    >
      {children}
    </div>
  )
}

export function SelectValue({ children, placeholder }) {
  const ctx = useContext(SelectContext)
  const display = ctx?.val ? ctx.val : (children || placeholder || 'Selecionar')
  const isPlaceholder = !ctx?.val
  return (
    <span className={`text-sm ${isPlaceholder ? 'text-gray-400' : 'text-gray-700'}`}>{display}</span>
  )
}

export function SelectContent({ children, className = '' }) {
  const ctx = useContext(SelectContext)
  if (!ctx?.open) return null
  return (
    <div className={`mt-2 bg-white border rounded-lg shadow ${className}`}>{children}</div>
  )
}

export function SelectItem({ children, value, className = '' }) {
  const ctx = useContext(SelectContext)
  return (
    <div
      className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${className}`}
      onClick={() => ctx?.handleChange && ctx.handleChange(value)}
    >
      {children}
    </div>
  )
}