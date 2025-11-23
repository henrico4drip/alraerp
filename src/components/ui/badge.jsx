import React from 'react'

export function Badge({ children, className = '', variant = 'default' }) {
  const base = variant === 'primary'
    ? 'inline-block text-xs px-2 py-1 rounded-lg bg-[#3490c7] text-white'
    : 'inline-block text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700'
  return <span className={`${base} ${className}`}>{children}</span>
}
