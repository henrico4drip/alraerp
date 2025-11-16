import React from 'react'

export function Input({ className = '', ...props }) {
  return (
    <input className={`w-full h-10 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`} {...props} />
  )
}