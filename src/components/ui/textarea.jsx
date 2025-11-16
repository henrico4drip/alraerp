import React from 'react'

export function Textarea({ className = '', ...props }) {
  return (
    <textarea className={`w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`} {...props} />
  )
}