
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState, initialHIndexCalculatorState } from '../contexts/TabsStateContext';
import { logEvent } from '../services/analyticsService';
import { RefreshIcon } from './icons/RefreshIcon';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import ProgressBar from './ProgressBar';
import { calculateHIndex } from '../services/hIndexService';
import { HIndexIcon } from './icons/HIndexIcon';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { DownloadIcon } from './icons/DownloadIcon';

const HIndexCalculatorTab: React.FC = () => {
    const { hIndexCalculatorState, setHIndexCalculatorState } = useTabsState();
    const { apiKey, affiliationId, isLoading, error, progress, result, startYear, endYear } = hIndexCalculatorState;
    const { t } = useLanguage();

    const setState = (updates: Partial<typeof hIndexCalculatorState>) => {
        setHIndexCalculatorState(prev => ({ ...prev, ...updates }));
    };

    const handleReset = () => {
        setState({ ...initialHIndexCalculatorState, apiKey });
    };

    const handleCalculate = async () => {
        if (!apiKey) {
            setState({ error: t('errorApiKeyRequired') });
            return;
        }
        if (!affiliationId.trim()) {
            setState({ error: t('hIndexErrorAffiliationId') });
            return;
        }
        setState({ isLoading: true, error: null, result: null, progress: null });
        logEvent('fetch_data_start', { module: 'h_index_calculator' });

        try {
            const finalResult = await calculateHIndex(apiKey, affiliationId.trim(), (prog) => {
                setState({ progress: prog });
            }, startYear, endYear);
            setState({ result: finalResult });
            logEvent('fetch_data_success', { module: 'h_index_calculator', h_index: finalResult.hIndex, publications_count: finalResult.totalPublications });
        } catch (err: any) {
            setState({ error: `${t('errorFetchFailed')}: ${err.message}` });
            logEvent('fetch_data_error', { module: 'h_index_calculator', error: err.message });
        } finally {
            setState({ isLoading: false, progress: null });
        }
    };
    
    const handleExport = () => {
        if (!result || !result.publications) return;
        const exportData = result.publications.map(p => ({
            [t('colTitle')]: p.title,
            [t('colDoi')]: p.doi,
            [t('colCitations')]: p.citedby_count,
            [t('colPubDate')]: p.publication_date,
            [t('colIndexingDate')]: p.indexing_date,
        }));
        exportObjectsToXlsx(exportData, `h-index-publications_${affiliationId}.xlsx`);
    };

    const effectiveStartYear = parseInt(startYear, 10) || new Date().getFullYear();
    const effectiveEndYear = parseInt(endYear, 10) || 1900;

    return (
        <div>
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <h2 className="text-xl font-bold text-secondary-800 mb-2">{t('hIndexTitle')}</h2>
                <p className="text-secondary-600">{t('hIndexDescription')}</p>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="apiKeyHIndex" className="block text-sm font-medium text-secondary-600 mb-2">{t('apiKeyLabel')}</label>
                    <input id="apiKeyHIndex" type="password" value={apiKey} onChange={(e) => setState({ apiKey: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('apiKeyPlaceholder')} />
                </div>
                 <div>
                    <label htmlFor="affiliationId" className="block text-sm font-medium text-secondary-600 mb-2">{t('hIndexAffiliationIdLabel')}</label>
                    <input id="affiliationId" type="text" value={affiliationId} onChange={(e) => setState({ affiliationId: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('hIndexAffiliationIdPlaceholder')} />
                </div>
                <div>
                    <label htmlFor="startYearHIndex" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
                    <input id="startYearHIndex" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder')} />
                </div>
                <div>
                    <label htmlFor="endYearHIndex" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
                    <input id="endYearHIndex" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder2')} />
                </div>
            </div>

            <div className="flex justify-end items-center gap-4 mb-6">
                <button
                    onClick={handleReset}
                    className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-secondary-300 flex items-center gap-2 h-12 shadow-md"
                    aria-label={t('resetButton')}
                >
                    <RefreshIcon />
                    <span>{t('resetButton')}</span>
                </button>
                <button
                    onClick={handleCalculate}
                    disabled={isLoading}
                    className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg"
                >
                    {isLoading ? <Loader /> : t('hIndexCalculateButton')}
                </button>
            </div>

            {error && <div className="mb-6"><ErrorMessage message={error} /></div>}

            {isLoading && (
                 <div className="mb-6 animate-slide-in-up">
                    <ProgressBar current={effectiveStartYear - (progress?.currentYear ?? effectiveStartYear)} total={effectiveStartYear - effectiveEndYear} text={progress?.message ?? t('progressStarting')} />
                </div>
            )}
            
            {result && !isLoading && (
                 <div className="p-8 bg-white rounded-2xl border border-secondary-200 shadow-xl animate-slide-in-up text-center max-w-lg mx-auto">
                    <div className="mx-auto h-16 w-16 mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-500 text-white shadow-lg flex items-center justify-center">
                       <HIndexIcon className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-secondary-900 mb-6">{t('hIndexResultTitle')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-8">
                        <div>
                            <p className="text-sm text-secondary-500 uppercase tracking-wider font-semibold">{t('hIndexResultValue')}</p>
                            <p className="text-4xl font-extrabold text-primary-600">{result.hIndex}</p>
                        </div>
                        <div>
                            <p className="text-sm text-secondary-500 uppercase tracking-wider font-semibold">{t('hIndexResultTotalPublications')}</p>
                            <p className="text-4xl font-extrabold text-primary-600">{result.totalPublications.toLocaleString()}</p>
                        </div>
                         <div>
                            <p className="text-sm text-secondary-500 uppercase tracking-wider font-semibold">{t('hIndexResultTime')}</p>
                            <p className="text-4xl font-extrabold text-primary-600">{result.calculationTime}</p>
                             <p className="text-xs text-secondary-500 -mt-1">{t('hIndexResultSeconds', { time: '' })}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 bg-secondary-700 hover:bg-secondary-800 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow"
                    >
                        <DownloadIcon />
                        {t('hIndexExportCitations')}
                    </button>
                </div>
            )}

        </div>
    );
};

export default HIndexCalculatorTab;