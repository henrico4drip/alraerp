import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DropdownContext = createContext(null);

export function DropdownMenu({ children }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <DropdownContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block text-left" ref={containerRef}>
                {children}
            </div>
        </DropdownContext.Provider>
    );
}

export function DropdownMenuTrigger({ children, asChild }) {
    const { open, setOpen } = useContext(DropdownContext);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            onClick: (e) => {
                if (children.props.onClick) children.props.onClick(e);
                setOpen(!open);
            }
        });
    }

    return (
        <div onClick={() => setOpen(!open)} className="cursor-pointer">
            {children}
        </div>
    );
}

export function DropdownMenuContent({ children, align = "right" }) {
    const { open } = useContext(DropdownContext);
    const alignClasses = align === "right" ? "right-0" : "left-0";

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className={`absolute ${alignClasses} mt-2 w-56 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-gray-100 p-1`}
                >
                    <div className="py-1">{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function DropdownMenuItem({ children, onClick, className = "" }) {
    const { setOpen } = useContext(DropdownContext);

    return (
        <div
            onClick={(e) => {
                if (onClick) onClick(e);
                setOpen(false);
            }}
            className={`flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors ${className}`}
        >
            {children}
        </div>
    );
}

export function DropdownMenuSeparator() {
    return <div className="my-1 border-t border-gray-100" />;
}
