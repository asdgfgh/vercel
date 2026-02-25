
import React, { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface InteractiveReviewProps {
    group: any[];
    currentIndex: number;
    total: number;
    onDecision: (recordsToKeep: any[]) => void;
}

const getDifferentFieldsInGroup = (group: any[]): Set<string> => {
    const diffs = new Set<string>();
    if (group.length < 2) return diffs;
    
    const allFields = Object.keys(group[0]).filter(k => k !== '_id' && !k.toLowerCase().includes('similarity'));

    allFields.forEach(field => {
        const firstValue = String(group[0][field] ?? '').trim().toLowerCase();
        for (let i = 1; i < group.length; i++) {
            const currentValue = String(group[i][field] ?? '').trim().toLowerCase();
            if (firstValue !== currentValue) {
                diffs.add(field);
                break;
            }
        }
    });
    return diffs;
};


const RecordCard: React.FC<{ record: any; diffs: Set<string>; isSelected: boolean; onToggle: () => void; index: number; }> = ({ record, diffs, isSelected, onToggle, index }) => {
    const { t } = useLanguage();

    const similarityKey = Object.keys(record).find(k => k.toLowerCase().includes('similarity'));
    const desiredFields = ['title', 'journal', 'doi', 'source', 'pub_type', 'type', 'year'];
    const fieldsToDisplay = desiredFields.filter(key => key in record);


    return (
        <div className={`flex-1 min-w-[300px] p-4 bg-white rounded-lg border-2 flex flex-col transition-opacity duration-300 ${isSelected ? 'border-primary-400 opacity-100' : 'border-secondary-200 opacity-50 hover:opacity-75'}`}>
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-secondary-800">Record {index + 1}</h4>
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        className="h-5 w-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 font-semibold text-secondary-700">{t('reviewSave')}</span>
                </label>
            </div>
            {similarityKey && record[similarityKey] && <p className="text-sm font-semibold text-primary-600 mb-2">{t('orcidSimilarity')}: {record[similarityKey]}</p>}
            <dl className="mt-2 space-y-2 text-sm flex-grow">
                {fieldsToDisplay.map(field => {
                    const value = record[field];
                    if (value === null || value === undefined || String(value).trim() === '') return null;
                    return (
                         <div key={field} className={`p-2 rounded-md ${diffs.has(field) ? 'bg-yellow-100 ring-1 ring-yellow-300' : 'bg-secondary-50/50'}`}>
                            <dt className="font-semibold text-secondary-600 capitalize">{field.replace(/_/g, ' ')}</dt>
                            <dd className="text-secondary-800 break-words">{typeof value === 'boolean' ? (value ? t('yes') : t('no')) : String(value)}</dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    )
};

const ITEMS_PER_PAGE = 6;

const InteractiveReview: React.FC<InteractiveReviewProps> = ({ group, currentIndex, total, onDecision }) => {
    const { t } = useLanguage();
    const [selectedIds, setSelectedIds] = useState<string[]>(() => group.map(r => r._id));
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(group.length / ITEMS_PER_PAGE);

    const paginatedGroup = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return group.slice(startIndex, endIndex);
    }, [group, currentPage]);

    const differentFields = useMemo(() => getDifferentFieldsInGroup(group), [group]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        const recordsToKeep = group.filter(r => selectedIds.includes(r._id));
        onDecision(recordsToKeep);
    };
    
    const goToPreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-secondary-800">{t('manualReviewSheetTitle')}</h3>
                <p className="text-sm font-semibold text-secondary-600 bg-secondary-200 px-3 py-1 rounded-full">{t('orcidReviewGroup', { current: currentIndex + 1, total })}</p>
            </div>
            <div className="flex flex-wrap gap-6 mb-6">
                {paginatedGroup.map((record, index) => (
                    <RecordCard
                        key={record._id || index}
                        record={record}
                        diffs={differentFields}
                        isSelected={selectedIds.includes(record._id)}
                        onToggle={() => handleToggle(record._id)}
                        index={(currentPage - 1) * ITEMS_PER_PAGE + index}
                    />
                ))}
            </div>
            
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 my-6">
                    <button 
                        onClick={goToPreviousPage} 
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-secondary-200 text-secondary-700 font-semibold rounded-lg hover:bg-secondary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('previousButtonText')}
                    >
                        &larr; {t('previousButtonText')}
                    </button>
                    <span className="text-sm font-semibold text-secondary-600">
                        {t('pageIndicator', { current: currentPage, total: totalPages })}
                    </span>
                    <button 
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-secondary-200 text-secondary-700 font-semibold rounded-lg hover:bg-secondary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('nextButtonText')}
                    >
                        {t('nextButtonText')} &rarr;
                    </button>
                </div>
            )}

             <div className="mt-6 border-t pt-6 flex justify-center">
                 <button
                    onClick={handleConfirm}
                    className="w-full max-w-sm bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg"
                >
                    {t('reviewConfirmAndContinue')}
                </button>
            </div>
        </div>
    );
};

export default InteractiveReview;
