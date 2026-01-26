import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

// Lazy load pages to avoid bundle bloat
import Home from './crm-new/Home';
import Inbox from './crm-new/Inbox';
import Contacts from './crm-new/Contacts';
import Funnel from './crm-new/Funnel';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function CRM() {
    return (
        <div className="crm-root">
            <ThemeProvider defaultTheme="light">
                <TooltipProvider>
                    <div className="min-h-screen bg-background text-foreground">
                        <Toaster richColors position="top-right" />
                        <Suspense fallback={<div className="flex items-center justify-center p-8">Carregando CRM...</div>}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/inbox" element={<Inbox />} />
                                <Route path="/contacts" element={<Contacts />} />
                                <Route path="/funnel" element={<Funnel />} />
                                <Route path="*" element={<Navigate to="/crm/inbox" replace />} />
                            </Routes>
                        </Suspense>
                    </div>
                </TooltipProvider>
            </ThemeProvider>
        </div>
    );
}
