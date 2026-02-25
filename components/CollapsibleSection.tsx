import React, { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`bg-secondary-50 rounded-2xl border border-secondary-200 shadow-lg animate-slide-in-up ${isOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className="w-full flex justify-between items-center p-4 sm:p-6 text-left"
            >
                <h3 className="text-xl font-bold text-secondary-800">{title}</h3>
                <ChevronDownIcon
                    className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            <div
                className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
                aria-hidden={!isOpen}
            >
                <div className={`px-4 sm:px-6 pb-6 ${isOpen ? 'border-t border-secondary-200 pt-6' : ''}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;