
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';


interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useLocalStorage('language', 'uk');
  const [translations, setTranslations] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const fetchTranslations = async (lang: string) => {
      try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) {
          throw new Error(`Could not load ${lang}.json`);
        }
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error(error);
        if (lang !== 'uk') {
            // Attempt to load fallback without getting into a loop
            const fallbackResponse = await fetch(`/locales/uk.json`);
            if (fallbackResponse.ok) {
                setTranslations(await fallbackResponse.json());
            } else {
                setTranslations({}); // Prevent infinite loop if fallback fails
            }
        } else {
            setTranslations({}); // Prevent infinite loop if default fails
        }
      }
    };

    fetchTranslations(language);
  }, [language]);

  const t = (key: string, options?: { [key: string]: string | number }): string => {
    if (!translations) {
      return key; // Return key while loading
    }
    let translation = translations[key] || key;
    if (options) {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{{${optionKey}}}`, String(options[optionKey]));
      });
    }
    return translation;
  };

  if (translations === null) {
    return null; // Block on initial render ONLY
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
