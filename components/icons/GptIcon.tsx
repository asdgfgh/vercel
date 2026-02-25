
import React from 'react';

export const GptIcon: React.FC<{className?: string}> = ({ className = "h-8 w-8" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2a5.5 5.5 0 0 0-5.5 5.5c0 2.228 1.324 4.142 3.25 5.01V17.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5V12.51c1.926-.868 3.25-2.782 3.25-5.01A5.5 5.5 0 0 0 12 2Z M7.5 7.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm9 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
    </svg>
);
