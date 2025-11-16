import React from 'react'

export function Label({ children, className = '', ...props }) {
  return (
    <label className={`text-sm text-gray-700 ${className}`} {...props}>{children}</label>
  )
}