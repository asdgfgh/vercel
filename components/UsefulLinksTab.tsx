
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LinkIcon } from './icons/LinkIcon';
import { GptIcon } from './icons/GptIcon';
import { SplitterIcon } from './icons/SplitterIcon';
import { GithubIcon } from './icons/GithubIcon';

interface UsefulLink {
    id: string;
    titleKey: string;
    descriptionKey: string;
    url: string;
    icon: React.ReactNode;
    colorClass: string;
    tag: string;
}

const UsefulLinksTab: React.FC = () => {
    const { t } = useLanguage();

    const links: UsefulLink[] = [
        {
            id: 'pan-mykhailo',
            titleKey: 'linkPanMykhailoTitle',
            descriptionKey: 'linkPanMykhailoDesc',
            url: 'https://chatgpt.com/g/g-692964a447788191876d58a26be31876-pan-mikhailo',
            icon: <GptIcon className="h-8 w-8" />,
            colorClass: 'bg-[#10a37f] text-white',
            tag: 'GPT Assistant'
        },
        {
            id: 'journal-splitter',
            titleKey: 'linkJournalSplitterTitle',
            descriptionKey: 'linkJournalSplitterDesc',
            url: 'https://splitter-tawny.vercel.app/',
            icon: <SplitterIcon className="h-8 w-8" />,
            colorClass: 'bg-primary-500 text-white',
            tag: 'AI Tool'
        },
        {
            id: 'music-archive',
            titleKey: 'linkMusicArchiveTitle',
            descriptionKey: 'linkMusicArchiveDesc',
            url: 'https://github.com/asdgfgh/music',
            icon: <GithubIcon className="h-8 w-8" />,
            colorClass: 'bg-secondary-800 text-white',
            tag: 'Source Code'
        }
    ];

    return (
        <div className="w-full max-w-5xl mx-auto animate-slide-in-up">
            {/* Header Section */}
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <div className="flex items-center gap-4 mb-2">
                    <LinkIcon className="h-8 w-8 text-primary-600" />
                    <h2 className="text-xl font-bold text-secondary-800">{t('usefulLinksTitle')}</h2>
                </div>
                <p className="text-secondary-600">{t('menuUsefulLinksDesc')}</p>
            </div>

            {/* Links Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {links.map((link) => (
                    <a 
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-white rounded-xl border border-secondary-200 shadow-sm p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-4 rounded-2xl shadow-inner transition-transform duration-300 group-hover:scale-110 ${link.colorClass}`}>
                                {link.icon}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400 py-1 px-2 bg-secondary-100 rounded-full group-hover:text-primary-600 transition-colors">
                                {link.tag}
                            </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-secondary-900 mb-3 group-hover:text-primary-700 transition-colors">
                            {t(link.titleKey as any)}
                        </h3>
                        
                        <p className="text-secondary-600 text-sm leading-relaxed mb-6 flex-grow">
                            {t(link.descriptionKey as any)}
                        </p>
                        
                        <div className="flex items-center text-primary-600 font-bold text-sm group-hover:gap-2 transition-all">
                            <span>{t('openLink' as any, { defaultValue: 'Open Link' })}</span>
                            <svg className="w-4 h-4 ml-1 transform transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </div>
                    </a>
                ))}
            </div>
            
            {/* Empty state */}
            {links.length === 0 && (
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-12 text-center">
                    <div className="mx-auto h-20 w-20 mb-6 rounded-full bg-secondary-100 text-secondary-400 flex items-center justify-center">
                        <LinkIcon className="h-10 w-10" />
                    </div>
                    <h3 className="text-xl font-semibold text-secondary-800 mb-2">{t('usefulLinksPlaceholder')}</h3>
                    <p className="text-secondary-500">Stay tuned for curated resources and external tool links.</p>
                </div>
            )}
        </div>
    );
};

export default UsefulLinksTab;
