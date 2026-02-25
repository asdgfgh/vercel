
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Tab } from '../App';
import { HomeIcon } from './icons/HomeIcon';
import { ScopusIcon } from './icons/ScopusIcon';
import { OrcidIcon } from './icons/OrcidIcon';
import { OpenAlexIcon } from './icons/OpenAlexIcon';
import { ZenodoIcon } from './icons/ZenodoIcon';
import { UnifiedProfileIcon } from './icons/UnifiedProfileIcon';
import { ScopusCitationIcon } from './icons/ScopusCitationIcon';
import { HIndexIcon } from './icons/HIndexIcon';
import { UnpaywallIcon } from './icons/UnpaywallIcon';
import { ApaIcon } from './icons/ApaIcon';
import { BatchIcon } from './icons/BatchIcon';
import { ManualVizIcon } from './icons/ManualVizIcon';
import { InstructionsIcon } from './icons/InstructionsIcon';
import { AdvancedSearchIcon } from './icons/AdvancedSearchIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { LinkIcon } from './icons/LinkIcon';

interface SidebarProps {
    activeTab: Tab;
    currentView: 'menu' | 'tabs';
    onSelectTab: (tab: Tab) => void;
    onGoHome: () => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, currentView, onSelectTab, onGoHome, isOpen, setIsOpen }) => {
    const { t } = useLanguage();

    const menuGroups = [
        {
            title: "Data Collection",
            items: [
                { id: 'scopus', label: t('menuScopusTitle'), icon: <ScopusIcon className="w-5 h-5" /> },
                { id: 'orcid', label: t('menuOrcidTitle'), icon: <OrcidIcon className="w-5 h-5" /> },
                { id: 'openalex', label: t('menuOpenalexTitle'), icon: <OpenAlexIcon className="w-5 h-5" /> },
                { id: 'zenodo', label: t('menuZenodoTitle'), icon: <ZenodoIcon className="w-5 h-5" /> },
            ]
        },
        {
            title: "Analytics & Metrics",
            items: [
                { id: 'unifiedProfile', label: t('menuUnifiedProfileTitle'), icon: <UnifiedProfileIcon className="w-5 h-5" /> },
                { id: 'advancedSearch', label: t('menuAdvancedSearchTitle'), icon: <AdvancedSearchIcon className="w-5 h-5" /> },
                { id: 'scopusCitation', label: t('menuScopusCitationTitle'), icon: <ScopusCitationIcon className="w-5 h-5" /> },
                { id: 'hIndexCalculator', label: t('menuHIndexCalculatorTitle'), icon: <HIndexIcon className="w-5 h-5" /> },
                { id: 'unpaywall', label: t('menuUnpaywallTitle'), icon: <UnpaywallIcon className="w-5 h-5" /> },
            ]
        },
        {
            title: "Tools & Utilities",
            items: [
                { id: 'apaGenerator', label: t('menuApaGeneratorTitle'), icon: <ApaIcon className="w-5 h-5" /> },
                { id: 'batch', label: t('menuBatchTitle'), icon: <BatchIcon className="w-5 h-5" /> },
                { id: 'manualVisualizer', label: t('menuManualVisualizerTitle'), icon: <ManualVizIcon className="w-5 h-5" /> },
                { id: 'radio', label: t('menuRadioTitle'), icon: <MusicNoteIcon className="w-5 h-5" /> },
            ]
        },
        {
            title: "Support",
            items: [
                { id: 'instructions', label: t('menuInstructionsTitle'), icon: <InstructionsIcon className="w-5 h-5" /> },
                { id: 'usefulLinks', label: t('menuUsefulLinksTitle'), icon: <LinkIcon className="w-5 h-5" /> },
            ]
        }
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div 
                className={`fixed inset-0 bg-secondary-900/50 z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Container */}
            <aside 
                className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-secondary-200 shadow-xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col h-full`}
            >
                {/* Logo Area */}
                <div className="p-6 border-b border-secondary-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={onGoHome}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm text-[10px]">
                            KNU
                        </div>
                        <span className="font-bold text-secondary-900 text-lg tracking-tight leading-none">Science<br/>Monitor</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-secondary-500 hover:text-secondary-800">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
                    
                    {/* Home Button */}
                    <button
                        onClick={onGoHome}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${currentView === 'menu' ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200' : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'}`}
                    >
                        <HomeIcon />
                        <span className="font-medium">{t('menuWelcome')}</span>
                    </button>

                    {menuGroups.map((group, idx) => (
                        <div key={idx}>
                            <h3 className="px-3 text-xs font-semibold text-secondary-400 uppercase tracking-wider mb-2">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = currentView === 'tabs' && activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                onSelectTab(item.id as Tab);
                                                if (window.innerWidth < 1024) setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${isActive ? 'bg-gradient-to-r from-primary-50 to-white border-l-4 border-primary-500 text-primary-700 shadow-sm' : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 border-l-4 border-transparent'}`}
                                        >
                                            <span className={`${isActive ? 'text-primary-600' : 'text-secondary-400 group-hover:text-secondary-600'}`}>
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer / Version */}
                <div className="p-4 border-t border-secondary-100 bg-secondary-50/50">
                    <p className="text-xs text-center text-secondary-400">
                        {t('footerText')}
                    </p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
