
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ErrorMessageProps {
  message: string | null;
}

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);


const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  const { t } = useLanguage();
  if (!message) return null;
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-md flex items-start gap-4 shadow-md animate-slide-in-up" role="alert">
        <div className="flex-shrink-0 text-red-500 mt-0.5">
            <ErrorIcon />
        </div>
        <div>
            <p className="font-bold">{t('errorTitle')}</p>
            <p>{message}</p>
        </div>
    </div>
  );
};

export default ErrorMessage;