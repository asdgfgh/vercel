import React from 'react';

export const ManualVizIcon: React.FC<{className?: string}> = ({ className = "h-8 w-8" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 13H3.055a9.001 9.001 0 007.945 7.945V13z" />
    </svg>
);