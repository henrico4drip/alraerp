import React, { useEffect } from "react";

export function Dialog({ open = false, onOpenChange = () => {}, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  );
}

export function DialogContent({ className = "", children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        // Close handled by parent via onOpenChange passed to Dialog backdrop
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`relative z-50 bg-white p-4 rounded-xl shadow-lg ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ className = "", children }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function DialogTitle({ className = "", children }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}