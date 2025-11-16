import React from "react";

const base = "inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
const sizes = {
  default: "h-9 px-3 py-2 text-sm",
  icon: "h-9 w-9"
};
const variants = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-900",
  outline: "border border-gray-200 text-gray-900 bg-white hover:bg-gray-50"
};

export function Button({ children, className = "", variant = "default", size = "default", ...props }) {
  const classes = `${base} ${sizes[size] || sizes.default} ${variants[variant] || variants.default} ${className}`;
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}