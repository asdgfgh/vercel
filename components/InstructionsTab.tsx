import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ScopusIcon } from './icons/ScopusIcon';
import { OrcidIcon } from './icons/OrcidIcon';
import { ZenodoIcon } from './icons/ZenodoIcon';
import { ApaIcon } from './icons/ApaIcon';
import { BatchIcon } from './icons/BatchIcon';
import { InstructionsIcon } from './icons/InstructionsIcon';
import { UnifiedProfileIcon } from './icons/UnifiedProfileIcon';
import { OpenAlexIcon } from './icons/OpenAlexIcon';
import { HIndexIcon } from './icons/HIndexIcon';
import { ManualVizIcon } from './icons/ManualVizIcon';
import { UnpaywallIcon } from './icons/UnpaywallIcon';
import { ScopusCitationIcon } from './icons/ScopusCitationIcon';
import { AdvancedSearchIcon } from './icons/AdvancedSearchIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { LinkIcon } from './icons/LinkIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { VersionIcon } from './icons/VersionIcon';

interface ContentItem {
    type: 'paragraph' | 'list' | 'subtitle' | 'important-paragraph';
    text?: string;
    items?: string[];
}

interface Section {
    id: string;
    title: string;
    icon: React.ReactElement;
    content: ContentItem[];
}

const InstructionsTab: React.FC = () => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [openSectionId, setOpenSectionId] = useState<string | null>('getting-started');

    const sections: Section[] = useMemo(() => [
        {
            id: 'getting-started',
            title: t('instGettingStartedTitle'),
            icon: <InstructionsIcon />,
            content: [
                { type: 'paragraph', text: t('instGettingStartedDesc1') },
                {
                    type: 'list', items: [
                        t('instGettingStartedLi1'),
                        t('instGettingStartedLi2'),
                        t('instGettingStartedLi3'),
                        t('instGettingStartedLi4'),
                    ]
                },
            ],
        },
        {
            id: 'scopus-search',
            title: t('instScopusTitle'),
            icon: <ScopusIcon />,
            content: [
                { type: 'paragraph', text: t('instScopusDesc1') },
                { type: 'list', items: [t('instScopusLi1'), t('instScopusLi2'), t('instScopusLi3')] },
                { type: 'paragraph', text: t('instScopusDesc2') },
                { type: 'list', items: [t('instScopusLi4'), t('instScopusLi5'), t('instScopusLi6')] },
            ],
        },
         {
            id: 'scopus-citation',
            title: t('instScopusCitationTitle'),
            icon: <ScopusCitationIcon />,
            content: [
                 { type: 'paragraph', text: t('instScopusCitationDesc1') },
                 { type: 'list', items: [t('instScopusCitationLi1'), t('instScopusCitationLi2')] },
            ],
        },
        {
            id: 'orcid-search',
            title: t('instOrcidTitle'),
            icon: <OrcidIcon />,
            content: [
                { type: 'paragraph', text: t('instOrcidDesc1') },
                { type: 'list', items: [t('instOrcidLi1'), t('instOrcidLi2'), t('instOrcidLi3')] },
                { type: 'paragraph', text: t('instOrcidDesc2') },
            ],
        },
         {
            id: 'unified-profile',
            title: t('instUnifiedProfileTitle'),
            icon: <UnifiedProfileIcon />,
            content: [
                 { type: 'paragraph', text: t('instUnifiedProfileDesc1') },
                 { type: 'list', items: [t('instUnifiedProfileLi1'), t('instUnifiedProfileLi2'), t('instUnifiedProfileLi3')] },
                 { type: 'paragraph', text: t('instUnifiedProfileDesc2') },
            ],
        },
        {
            id: 'advanced-search',
            title: t('instAdvancedSearchTitle'),
            icon: <AdvancedSearchIcon />,
            content: [
                 { type: 'paragraph', text: t('instAdvancedSearchDesc1') },
                 { type: 'list', items: [t('instAdvancedSearchLi1'), t('instAdvancedSearchLi2'), t('instAdvancedSearchLi3'), t('instAdvancedSearchLi4')] },
                 { type: 'paragraph', text: t('instAdvancedSearchDesc2') },
            ],
        },
        {
            id: 'openalex-search',
            title: t('instOpenAlexTitle'),
            icon: <OpenAlexIcon />,
            content: [
                { type: 'paragraph', text: t('instOpenAlexDesc1') },
                { type: 'list', items: [t('instOpenAlexLi1'), t('instOpenAlexLi2')] },
                { type: 'paragraph', text: t('instOpenAlexDesc2') },
                { type: 'important-paragraph', text: t('instOpenAlexDesc3') },
            ],
        },
        {
            id: 'zenodo-search',
            title: t('instZenodoTitle'),
            icon: <ZenodoIcon />,
            content: [
                 { type: 'paragraph', text: t('instZenodoDesc1') },
                 { type: 'list', items: [t('instZenodoLi1'), t('instZenodoLi2')] },
                 { type: 'paragraph', text: t('instZenodoDesc2') },
            ],
        },
        {
            id: 'unpaywall-check',
            title: t('instUnpaywallTitle'),
            icon: <UnpaywallIcon />,
            content: [
                 { type: 'paragraph', text: t('instUnpaywallDesc1') },
                 { type: 'list', items: [t('instUnpaywallLi1'), t('instUnpaywallLi2'), t('instUnpaywallLi3')] },
                 { type: 'paragraph', text: t('instUnpaywallDesc2') },
            ],
        },
        {
            id: 'apa-generator',
            title: t('instApaTitle'),
            icon: <ApaIcon />,
            content: [
                 { type: 'paragraph', text: t('instApaDesc1') },
                 { type: 'list', items: [t('instApaLi1'), t('instApaLi2'), t('instApaLi3')] },
                 { type: 'paragraph', text: t('instApaDesc2') },
            ],
        },
        {
            id: 'h-index-calculator',
            title: t('instHIndexTitle'),
            icon: <HIndexIcon />,
            content: [
                 { type: 'paragraph', text: t('instHIndexDesc1') },
                 { type: 'list', items: [t('instHIndexLi1'), t('instHIndexLi2'), t('instHIndexLi3')] },
                 { type: 'paragraph', text: t('instHIndexDesc2') },
            ],
        },
        {
            id: 'table-tools',
            title: t('instTableTitle'),
            icon: <BatchIcon />,
            content: [
                { type: 'paragraph', text: t('instTableDesc1') },
                { type: 'subtitle', text: t('instTableMergeTitle') },
                { type: 'paragraph', text: t('instTableMergeDesc') },
                { type: 'list', items: [t('instTableMergeLi1'), t('instTableMergeLi2'), t('instTableMergeLi3'), t('instTableMergeLi4'), t('instTableMergeLi5')] },
                { type: 'subtitle', text: t('instTableDedupeTitle') },
                { type: 'paragraph', text: t('instTableDedupeDesc') },
                { type: 'list', items: [t('instTableDedupeLi1'), t('instTableDedupeLi2')] },
                { type: 'subtitle', text: t('instTableInteractiveDedupeTitle') },
                { type: 'paragraph', text: t('instTableInteractiveDedupeDesc') },
                { type: 'list', items: [t('instTableInteractiveDedupeLi1'), t('instTableInteractiveDedupeLi2')] },
                { type: 'subtitle', text: t('instTableFillGroupTitle') },
                { type: 'paragraph', text: t('instTableFillGroupDesc') },
                { type: 'list', items: [t('instTableFillGroupLi1')] },
                { type: 'subtitle', text: t('instTableVisualizeTitle') },
                { type: 'paragraph', text: t('instTableVisualizeDesc') },
                { type: 'list', items: [t('instTableVisualizeLi1')] },
            ],
        },
        {
            id: 'manual-visualizer',
            title: t('instManualVizTitle'),
            icon: <ManualVizIcon />,
            content: [
                { type: 'paragraph', text: t('instManualVizDesc') },
                { type: 'subtitle', text: t('instManualVizSummaryTitle') },
                { type: 'paragraph', text: t('instManualVizSummaryDesc') },
                { type: 'subtitle', text: t('instManualVizRawTitle') },
                { type: 'paragraph', text: t('instManualVizRawDesc') },
            ],
        },
        {
            id: 'radio-7',
            title: t('instRadioTitle'),
            icon: <MusicNoteIcon />,
            content: [
                { type: 'paragraph', text: t('instRadioDesc1') },
                { type: 'list', items: [t('instRadioLi1'), t('instRadioLi2'), t('instRadioLi3'), t('instRadioLi4')] },
            ],
        },
        {
            id: 'useful-links',
            title: t('instUsefulLinksTitle'),
            icon: <LinkIcon />,
            content: [
                { type: 'paragraph', text: t('instUsefulLinksDesc1') },
                { type: 'list', items: [t('instUsefulLinksLi1'), t('instUsefulLinksLi2')] },
            ],
        },
        {
            id: 'version',
            title: t('instVersionTitle'),
            icon: <VersionIcon />,
            content: [
                { type: 'paragraph', text: t('instVersionDesc1') },
            ],
        },
    ], [t]);

    const filteredSections = useMemo(() => {
        if (!searchTerm) return sections;
        const lowercasedTerm = searchTerm.toLowerCase();

        return sections.filter(section => {
            const titleMatch = section.title.toLowerCase().includes(lowercasedTerm);
            if (titleMatch) return true;

            const contentMatch = section.content.some(item => {
                const textToSearch = (item.text || (item.items || []).join(' ')).toLowerCase().replace(/<[^>]*>?/gm, '');
                return textToSearch.includes(lowercasedTerm);
            });
            return contentMatch;
        });
    }, [searchTerm, sections]);

    const handleToggle = (sectionId: string) => {
        setOpenSectionId(prevId => (prevId === sectionId ? null : sectionId));
    };

    const renderContent = (content: ContentItem[]) => {
        return content.map((item, idx) => {
            switch (item.type) {
                case 'paragraph':
                    return <p key={idx} className="text-secondary-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text || '' }} />;
                case 'important-paragraph':
                    return <div key={idx} className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg"><p className="font-semibold">{item.text}</p></div>;
                case 'list':
                    return <ul key={idx} className="list-disc list-inside space-y-2 pl-4 text-secondary-700">{item.items?.map((li, liIdx) => <li key={liIdx} dangerouslySetInnerHTML={{ __html: li }} />)}</ul>;
                case 'subtitle':
                    return <h3 key={idx} className="text-lg font-bold text-secondary-800 pt-4 mt-4 border-t border-secondary-100">{item.text}</h3>;
                default:
                    return null;
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto animate-slide-in-up">
            <div className="relative mb-8">
                <input 
                    type="text"
                    placeholder={t('instSearchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-secondary-300 rounded-xl bg-white text-lg focus:outline-none focus:ring-4 focus:ring-primary-300 focus:border-primary-500 transition-shadow"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary-400">
                    <SearchIcon className="w-6 h-6"/>
                </div>
            </div>

            <div className="space-y-4">
                {filteredSections.length > 0 ? (
                    filteredSections.map(section => (
                        <div key={section.id} className="bg-white rounded-xl border border-secondary-200 shadow-sm transition-shadow hover:shadow-lg">
                            <button
                                onClick={() => handleToggle(section.id)}
                                className="w-full flex justify-between items-center p-5 text-left"
                                aria-expanded={openSectionId === section.id}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-primary-600">
                                        {React.cloneElement(section.icon, { className: 'h-7 w-7' })}
                                    </div>
                                    <h2 className="text-xl font-bold text-secondary-900">{section.title}</h2>
                                </div>
                                <ChevronDownIcon className={`w-6 h-6 text-secondary-500 transform transition-transform duration-300 ${openSectionId === section.id ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <div 
                                className={`transition-all duration-500 ease-in-out overflow-hidden ${openSectionId === section.id ? 'max-h-[2000px]' : 'max-h-0'}`}
                            >
                                <div className="px-5 pb-5 pt-2 border-t border-secondary-200">
                                    <div className="space-y-4">
                                        {renderContent(section.content)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 bg-white rounded-xl border border-secondary-200">
                        <p className="text-secondary-500">{t('instSearchNotFound')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstructionsTab;