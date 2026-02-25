import React from 'react';
import type { Tab } from '../App';
import { ScopusIcon } from './icons/ScopusIcon';
import { OrcidIcon } from './icons/OrcidIcon';
import { ZenodoIcon } from './icons/ZenodoIcon';
import { ApaIcon } from './icons/ApaIcon';
import { BatchIcon } from './icons/BatchIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { InstructionsIcon } from './icons/InstructionsIcon';
import { UnifiedProfileIcon } from './icons/UnifiedProfileIcon';
import { OpenAlexIcon } from './icons/OpenAlexIcon';
import { HIndexIcon } from './icons/HIndexIcon';
import { ManualVizIcon } from './icons/ManualVizIcon';
import { UnpaywallIcon } from './icons/UnpaywallIcon';
import { ScopusCitationIcon } from './icons/ScopusCitationIcon';
import { useTabsState } from '../contexts/TabsStateContext';
import { AdvancedSearchIcon } from './icons/AdvancedSearchIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { LinkIcon } from './icons/LinkIcon';

interface MainMenuProps {
    onSelect: (tab: Tab) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
    const { t } = useLanguage();
    const { isMykhailoMode } = useTabsState();

    const menuItems = [
        {
            tab: 'instructions' as Tab,
            title: t('menuInstructionsTitle'),
            description: t('menuInstructionsDesc'),
            icon: <InstructionsIcon />,
            disabled: false,
            imageIndex: 1,
        },
        {
            tab: 'scopus' as Tab,
            title: t('menuScopusTitle'),
            description: t('menuScopusDesc'),
            icon: <ScopusIcon />,
            disabled: false,
            imageIndex: 2,
        },
        {
            tab: 'scopusCitation' as Tab,
            title: t('menuScopusCitationTitle'),
            description: t('menuScopusCitationDesc'),
            icon: <ScopusCitationIcon />,
            disabled: false,
            imageIndex: 3,
        },
        {
            tab: 'orcid' as Tab,
            title: t('menuOrcidTitle'),
            description: t('menuOrcidDesc'),
            icon: <OrcidIcon />,
            disabled: false,
            imageIndex: 4,
        },
        {
            tab: 'unifiedProfile' as Tab,
            title: t('menuUnifiedProfileTitle'),
            description: t('menuUnifiedProfileDesc'),
            icon: <UnifiedProfileIcon />,
            disabled: false,
            imageIndex: 5,
        },
        {
            tab: 'openalex' as Tab,
            title: t('menuOpenalexTitle'),
            description: t('menuOpenalexDesc'),
            icon: <OpenAlexIcon />,
            disabled: false,
            imageIndex: 6,
        },
        {
            tab: 'zenodo' as Tab,
            title: t('menuZenodoTitle'),
            description: t('menuZenodoDesc'),
            icon: <ZenodoIcon />,
            disabled: false,
            imageIndex: 7,
        },
        {
            tab: 'unpaywall' as Tab,
            title: t('menuUnpaywallTitle'),
            description: t('menuUnpaywallDesc'),
            icon: <UnpaywallIcon />,
            disabled: false,
            imageIndex: 8,
        },
        {
            tab: 'apaGenerator' as Tab,
            title: t('menuApaGeneratorTitle'),
            description: t('menuApaGeneratorDesc'),
            icon: <ApaIcon />,
            disabled: false,
            imageIndex: 9,
        },
        {
            tab: 'hIndexCalculator' as Tab,
            title: t('menuHIndexCalculatorTitle'),
            description: t('menuHIndexCalculatorDesc'),
            icon: <HIndexIcon />,
            disabled: false,
            imageIndex: 10,
        },
        {
            tab: 'batch' as Tab,
            title: t('menuBatchTitle'),
            description: t('menuBatchDesc'),
            icon: <BatchIcon />,
            disabled: false,
            imageIndex: 11,
        },
        {
            tab: 'manualVisualizer' as Tab,
            title: t('menuManualVisualizerTitle'),
            description: t('menuManualVisualizerDesc'),
            icon: <ManualVizIcon />,
            disabled: false,
            imageIndex: 12,
        },
        {
            tab: 'advancedSearch' as Tab,
            title: t('menuAdvancedSearchTitle'),
            description: t('menuAdvancedSearchDesc'),
            icon: <AdvancedSearchIcon />,
            disabled: false,
            imageIndex: 13,
        },
        {
            tab: 'radio' as Tab,
            title: t('menuRadioTitle'),
            description: t('menuRadioDesc'),
            icon: <MusicNoteIcon />,
            disabled: false,
            imageIndex: 14,
        },
        {
            tab: 'usefulLinks' as Tab,
            title: t('menuUsefulLinksTitle'),
            description: t('menuUsefulLinksDesc'),
            icon: <LinkIcon />,
            disabled: false,
            imageIndex: 15,
        },
    ];

    return (
        <div className="animate-slide-in-up">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-secondary-800">{t('menuWelcome')}</h2>
                <p className="mt-2 text-lg text-secondary-600">{t('menuSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {menuItems.map((item) => (
                    <button
                        key={item.tab}
                        onClick={() => !item.disabled && onSelect(item.tab)}
                        disabled={item.disabled}
                        className={`group relative bg-white rounded-2xl shadow-lg border border-secondary-100 text-left transition-all duration-300 ease-in-out transform hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary-300 flex flex-col h-full overflow-hidden ${item.disabled ? 'opacity-50 cursor-not-allowed bg-secondary-100' : 'cursor-pointer'}`}
                    >
                        {isMykhailoMode ? (
                            <div className="p-8 pb-0 flex justify-center">
                                <div className="w-48 h-48 bg-secondary-50 overflow-hidden rounded-xl border border-secondary-100 flex items-center justify-center">
                                    <img 
                                        src={`/assets/${item.imageIndex}.png`} 
                                        alt={item.title}
                                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                                        onError={(e) => {
                                            // Fallback if image not found
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.nextElementSibling?.classList.remove('hidden');
                                            e.currentTarget.parentElement?.classList.add('hidden');
                                        }}
                                    />
                                </div>
                                <div className="hidden h-16 w-16 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-500 text-white shadow-md">
                                     {item.icon}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 pb-0">
                                <div className="flex items-center justify-center h-16 w-16 mb-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 text-white shadow-md">
                                    {item.icon}
                                </div>
                            </div>
                        )}
                        
                        <div className="p-8 pt-6 flex-grow">
                            <h3 className="text-xl font-bold text-secondary-900 mb-2 group-hover:text-primary-700 transition-colors">{item.title}</h3>
                            <p className="text-secondary-600 leading-relaxed">{item.description}</p>
                        </div>
                        
                         {item.disabled && <span className="absolute top-4 right-4 text-xs font-bold uppercase text-secondary-500 bg-secondary-200 px-2 py-1 rounded-full">{t('soonTag')}</span>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MainMenu;