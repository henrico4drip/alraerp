import React from 'react'

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`} {...props}>{children}</div>
  )
}

export function CardHeader({ children, className = '', ...props }) {
  return <div className={`p-4 border-b border-gray-100 ${className}`} {...props}>{children}</div>
}

export function CardTitle({ children, className = '', ...props }) {
  return <h3 className={`text-sm font-semibold text-gray-900 ${className}`} {...props}>{children}</h3>
}

export function CardContent({ children, className = '', ...props }) {
  return <div className={`p-4 ${className}`} {...props}>{children}</div>
}