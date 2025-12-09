import React from 'react'

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input ref={ref} className={`w-full h-9 px-2 text-sm sm:h-10 sm:px-3 sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`} {...props} />
  )
})
