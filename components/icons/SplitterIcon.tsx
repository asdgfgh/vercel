
import React from 'react';

export const SplitterIcon: React.FC<{className?: string}> = ({ className = "h-6 w-6" }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 3V21" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
        <path d="M7 8H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M7 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M7 16H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M15 8H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M15 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M15 16H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
);
