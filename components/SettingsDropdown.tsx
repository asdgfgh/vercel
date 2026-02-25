
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { SettingsIcon } from './icons/SettingsIcon';
import { useTabsState } from '../contexts/TabsStateContext';

const SettingsDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { isMykhailoMode, setIsMykhailoMode, clearAllData } = useTabsState();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="p-2 rounded-full text-secondary-600 hover:bg-secondary-200 hover:text-primary-700 transition-all duration-300"
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50 border border-secondary-200 animate-slide-in-up origin-top-right">
          <div className="py-2">
            <p className="px-4 py-1 text-xs text-secondary-500 uppercase font-bold tracking-wider">Language</p>
            <div className="flex px-4 py-2 gap-2">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`flex-1 text-center py-1.5 rounded-md text-sm transition-colors ${language === 'en' ? 'font-bold bg-primary-100 text-primary-700' : 'text-secondary-700 hover:bg-secondary-100 border border-secondary-200'}`}
              >
                English
              </button>
              <button
                onClick={() => handleLanguageChange('uk')}
                className={`flex-1 text-center py-1.5 rounded-md text-sm transition-colors ${language === 'uk' ? 'font-bold bg-primary-100 text-primary-700' : 'text-secondary-700 hover:bg-secondary-100 border border-secondary-200'}`}
              >
                Укр
              </button>
            </div>
            
            <div className="h-px bg-secondary-100 my-1 mx-4"></div>

            <div className="px-4 py-2">
              <button
                onClick={clearAllData}
                className="w-full text-left px-3 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50"
              >
                {t('settingsClearData')}
              </button>
            </div>
            
            <div className="h-px bg-secondary-100 my-1 mx-4"></div>
            
            <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-secondary-700">{t('settingsMykhailoMode')}</span>
                <button
                    onClick={() => setIsMykhailoMode(!isMykhailoMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isMykhailoMode ? 'bg-primary-500' : 'bg-secondary-300'}`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMykhailoMode ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
