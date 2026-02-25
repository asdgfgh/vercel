import React from 'react';

export const EqualizerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="6" width="4" height="12" rx="1">
            <animate attributeName="height" attributeType="XML"
                values="12;18;12;6;12"
                begin="0s" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y" attributeType="XML"
                values="6;3;6;9;6"
                begin="0s" dur="0.8s" repeatCount="indefinite" />
        </rect>
        <rect x="10" y="6" width="4" height="12" rx="1">
            <animate attributeName="height" attributeType="XML"
                values="12;18;12;6;12"
                begin="0.2s" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y" attributeType="XML"
                values="6;3;6;9;6"
                begin="0.2s" dur="0.8s" repeatCount="indefinite" />
        </rect>
        <rect x="16" y="6" width="4" height="12" rx="1">
            <animate attributeName="height" attributeType="XML"
                values="12;18;12;6;12"
                begin="0.4s" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="y" attributeType="XML"
                values="6;3;6;9;6"
                begin="0.4s" dur="0.8s" repeatCount="indefinite" />
        </rect>
    </svg>
);
