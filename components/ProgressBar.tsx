import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  text: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, text }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full bg-secondary-100 rounded-lg p-4 border border-secondary-200 shadow-sm animate-pulse">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium text-secondary-700">{text}</p>
        <p className="text-sm font-semibold text-primary-700">
          {Math.round(percentage)}%
        </p>
      </div>
      <div className="w-full bg-secondary-200 rounded-full h-2.5">
        <div
          className="bg-gradient-to-r from-primary-400 to-primary-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
