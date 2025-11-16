import React from 'react'

export function Alert({ children, className = '' }) {
  return (
    <div className={`flex items-start p-3 border rounded-lg ${className}`}>{children}</div>
  )
}

export function AlertDescription({ children, className = '' }) {
  return (
    <div className={`text-sm ${className}`}>{children}</div>
  )
}