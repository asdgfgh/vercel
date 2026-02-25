import React, { useCallback, useEffect, useState } from 'react';
import DataTable from './DataTable';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialOpenAlexState, DashboardWidget } from '../contexts/TabsStateContext';
import { logEvent } from '../services/analyticsService';
import ProgressBar from './ProgressBar';
import { fetchOpenAlexPublications, fetchWorkTypes } from '../services/openAlexService';
import type { OpenAlexPublication, YearRange } from '../types';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import ChartConstructor from './ChartConstructor';
import CollapsibleSection from './CollapsibleSection';
import Dashboard from './Dashboard';


const ROR_NAME = "Taras Shevchenko National University of Kyiv";
const ROR_ID_URL = "https://ror.org/02aaqv166";

const OpenAlexTab: React.FC = () => {
    const { openAlexState, setOpenAlexState } = useTabsState();
    // Fix: Replace chartConfigY with chartConfigYCalculation and chartConfigYValueColumn
    const { startYear, endYear, publicationTypes, selectedPublicationTypes, results, isLoading, error, statusText, progress, isLoadingTypes, statsStartYear, statsEndYear, chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType, chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay, dashboardLayouts, dashboardWidgets } = openAlexState;

    const { t } = useLanguage();
    const [statsView, setStatsView] = useState<'reports' | 'chart' | 'dashboard'>('reports');

    const setState = (updates: Partial<typeof openAlexState>) => {
        setOpenAlexState(prev => ({ ...prev, ...updates }));
    };

    const columns: { header: string; accessor: keyof OpenAlexPublication }[] = [
        { header: t('colTitle'), accessor: 'title' },
        { header: t('colAuthors'), accessor: 'authors' },
        { header: t('colKnuAuthorsOrcid'), accessor: 'knu_authors_orcid' },
        { header: t('colYear'), accessor: 'publication_year' },
        { header: t('colJournal'), accessor: 'journal' },
        { header: t('colType'), accessor: 'type' },
        { header: t('colCitations'), accessor: 'cited_by_count' },
        { header: t('colDoi'), accessor: 'doi' },
        { header: t('colOpenAccessStatus'), accessor: 'open_access_status' },
        { header: t('colUrl'), accessor: 'url' },
    ];

    useEffect(() => {
        const getTypes = async () => {
            if (publicationTypes.length > 0) return;
            setState({ isLoadingTypes: true, error: null });
            try {
                const types = await fetchWorkTypes();
                const sortedTypes = types.sort((a, b) => a.display_name.localeCompare(b.display_name));
                setState({ publicationTypes: sortedTypes, selectedPublicationTypes: sortedTypes.map(t => t.id) });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setState({ error: `${t('errorFetchFailed')}: ${message}` });
            } finally {
                setState({ isLoadingTypes: false });
            }
        };
        getTypes();
    }, [t]);

    const handleReset = () => {
        const currentTypes = openAlexState.publicationTypes;
        const currentSelection = openAlexState.selectedPublicationTypes;
        setOpenAlexState({...initialOpenAlexState, publicationTypes: currentTypes, selectedPublicationTypes: currentSelection});
    };

    const handleFetch = useCallback(async () => {
        setState({ isLoading: true, error: null, results: [], statusText: t('openAlexProgressPreparing'), progress: null });
        logEvent('fetch_data_start', { module: 'openalex' });
        const yearRange: YearRange = {
            start: startYear ? parseInt(startYear) : undefined,
            end: endYear ? parseInt(endYear) : undefined,
        };

        try {
            const onProgress = (page: number, total: number | null) => {
                 setState({ 
                    progress: total ? { current: page, total: total } : null,
                    statusText: t('openAlexProgressFetching', { page: page, total: total || '...' })
                });
            };
            const publications = await fetchOpenAlexPublications(yearRange, selectedPublicationTypes, onProgress);
            
            const defaultWidgets: DashboardWidget[] = [
                { id: 'total_pubs', type: 'total_publications' },
                { id: 'pubs_by_year', type: 'publications_by_year', config: { yearKey: 'publication_year' } },
                { id: 'pubs_by_type', type: 'publications_by_type', config: { typeKey: 'type' } },
            ];
            const defaultLayouts = {
                lg: [
                    { i: 'total_pubs', x: 0, y: 0, w: 4, h: 2 },
                    { i: 'pubs_by_year', x: 0, y: 2, w: 12, h: 4 },
                    { i: 'pubs_by_type', x: 4, y: 0, w: 8, h: 6 },
                ],
            };

            setState({ 
                results: publications,
                chartColumns: columns.map(c => ({ accessor: c.accessor as string, header: c.header })),
                statsStartYear: startYear,
                statsEndYear: endYear,
                statusText: t('progressComplete', { count: publications.length }),
                dashboardWidgets: defaultWidgets,
                dashboardLayouts: defaultLayouts,
            });
            logEvent('fetch_data_success', { module: 'openalex', count: publications.length });
        } catch (e: any) {
            setState({ error: `${t('errorFetchOpenAlex')}: ${e.message}`, statusText: t('progressFailed') });
            logEvent('fetch_data_error', { module: 'openalex', error: e.message });
        } finally {
            setState({ isLoading: false, progress: null });
        }
    }, [startYear, endYear, selectedPublicationTypes, t]);

    const handleTypeSelection = (typeId: string) => {
        const newSelection = selectedPublicationTypes.includes(typeId)
            ? selectedPublicationTypes.filter(id => id !== typeId)
            : [...selectedPublicationTypes, typeId];
        setState({ selectedPublicationTypes: newSelection });
    };
    
    const handleSelectAllTypes = () => setState({ selectedPublicationTypes: publicationTypes.map(t => t.id) });
    const handleDeselectAllTypes = () => setState({ selectedPublicationTypes: [] });

    const getFilteredAndPreppedStats = () => {
      setState({ error: null });
      const yearFilteredResults = results.filter(pub => {
          if (!pub.publication_year) return false;
          const pubYear = pub.publication_year;
          const start = statsStartYear ? parseInt(statsStartYear, 10) : -Infinity;
          const end = statsEndYear ? parseInt(statsEndYear, 10) : Infinity;
          return pubYear >= start && pubYear <= end;
      });

      if (yearFilteredResults.length === 0) {
          setState({ error: t('errorNoPublicationsForYears') });
          return null;
      }
      
      const pubTypes: string[] = [...new Set(yearFilteredResults.map<string>(p => String(p.type || 'N/A')))].sort();
      return { yearFilteredResults, pubTypes };
    };

     const handleGenerateStatsByYear = () => {
        const prep = getFilteredAndPreppedStats();
        if (!prep) return;
        const { yearFilteredResults, pubTypes } = prep;
        
        const statsByYear: { [year: string]: { [type: string]: number } } = {};

        yearFilteredResults.forEach(pub => {
            const year = String(pub.publication_year || 'N/A');
            const type = pub.type || 'N/A';
            if (!statsByYear[year]) {
                statsByYear[year] = { 'Total Publications': 0 };
                pubTypes.forEach(t => statsByYear[year][t] = 0);
            }
            statsByYear[year][type]++;
            statsByYear[year]['Total Publications']++;
        });

        const statsData = Object.keys(statsByYear).sort().map(year => ({
            'Year': year,
            ...statsByYear[year]
        }));
        
        exportObjectsToXlsx(statsData, 'openalex_stats_by_year.xlsx');
    };

    const handleGenerateStatsSummary = () => {
        const prep = getFilteredAndPreppedStats();
        if (!prep) return;
        const { yearFilteredResults, pubTypes } = prep;

        const stats: { [type: string]: number } = {};
        pubTypes.forEach(type => stats[type] = 0);

        yearFilteredResults.forEach(pub => {
            const type = pub.type || 'N/A';
            stats[type]++;
        });

        const statsData = Object.keys(stats).sort().map(type => ({
            'Publication Type': type,
            'Total Publications': stats[type]
        }));

        exportObjectsToXlsx(statsData, 'openalex_stats_summary.xlsx');
    };

    // Fix: Update handleChartConfigChange to accept yCalculation and yValueColumn keys
    const handleChartConfigChange = (key: 'x' | 'yCalculation' | 'yValueColumn' | 'group' | 'type' | 'labelDisplay', value: string) => {
        const newConfig = { [`chartConfig${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
        if (key === 'type' && value === 'pie') {
            newConfig['chartConfigGroup'] = 'none';
            newConfig['chartConfigFilterGroup'] = null;
        }
         if (key === 'x') {
            newConfig['chartConfigFilterX'] = null;
        }
        if (key === 'group') {
            newConfig['chartConfigFilterGroup'] = null;
        }
        setState(newConfig as any);
    };

    const handleChartFilterChange = (key: 'x' | 'group', value: string[] | null) => {
        const newFilters = { [`chartConfigFilter${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
        setState(newFilters as any);
    };

    return (
        <div>
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <h2 className="text-xl font-bold text-secondary-800 mb-2">{t('openAlexSearchTab')}</h2>
                <p className="text-secondary-600">{t('openAlexDescription')} <a href={ROR_ID_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-800 hover:underline">{ROR_NAME}</a>.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startYearOpenAlex" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
                        <input id="startYearOpenAlex" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder')} />
                    </div>
                    <div>
                        <label htmlFor="endYearOpenAlex" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
                        <input id="endYearOpenAlex" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder2')} />
                    </div>
                </div>
                <div className="space-y-2">
                     <label className="block text-sm font-medium text-secondary-600">{t('publicationTypesLabel')}</label>
                     {isLoadingTypes ? (
                         <div className="text-sm text-secondary-500 animate-pulse">{t('fetchingPublicationTypes')}</div>
                     ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSelectAllTypes} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}</button>
                                <span className="text-secondary-300">|</span>
                                <button onClick={handleDeselectAllTypes} className="text-xs font-semibold text-primary-600 hover:underline">{t('deselectAll')}</button>
                            </div>
                            <div className="max-h-32 overflow-y-auto border border-secondary-300 rounded-lg p-2 bg-white space-y-1">
                                {publicationTypes.map(type => (
                                    <div key={type.id} className="flex items-center p-1 hover:bg-primary-50 rounded">
                                        <input
                                            id={`type-${type.id}`}
                                            type="checkbox"
                                            checked={selectedPublicationTypes.includes(type.id)}
                                            onChange={() => handleTypeSelection(type.id)}
                                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <label htmlFor={`type-${type.id}`} className="ml-2 block text-sm text-secondary-700 truncate cursor-pointer flex-1">{type.display_name}</label>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-secondary-500 mt-1">{t('filterSelectionInfo', { selected: selectedPublicationTypes.length, total: publicationTypes.length })}</p>
                        </>
                     )}
                </div>
            </div>

            <div className="flex justify-end items-center gap-4 mb-6">
                <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-secondary-300 flex items-center gap-2 h-12 shadow-md" aria-label={t('resetButton')}>
                    <RefreshIcon />
                    <span>{t('resetButton')}</span>
                </button>
                <button onClick={handleFetch} disabled={isLoading || isLoadingTypes} className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg">
                    {isLoading ? <Loader /> : t('fetchDataButton')}
                </button>
            </div>
            
            {isLoading && (progress ? (
              <div className="mb-6">
                <ProgressBar current={progress.current} total={progress.total} text={statusText} />
              </div>
            ) : (
               <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md mb-6 animate-pulse">
                {statusText || t('progressStarting')}
              </div>
            ))}
            
            {!isLoading && statusText && !error && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-6">
                    {statusText}
                </div>
            )}

            {error && <ErrorMessage message={error}/>}

            {results.length > 0 && (
                <div className="mb-8">
                    <CollapsibleSection title={t('statisticsSectionTitle')} defaultOpen={true}>
                        <div className="border-b border-secondary-200 mb-4">
                            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                                <button onClick={() => setStatsView('reports')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${statsView === 'reports' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                    {t('statsTabReports')}
                                </button>
                                <button onClick={() => setStatsView('chart')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${statsView === 'chart' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                    {t('statsTabVisualization')}
                                </button>
                                <button onClick={() => setStatsView('dashboard')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${statsView === 'dashboard' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                    {t('statsTabDashboard')}
                                </button>
                            </nav>
                        </div>

                        {statsView === 'reports' && (
                        <div className="animate-slide-in-up">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-white rounded-xl border border-secondary-200 shadow-sm">
                                <div>
                                <label htmlFor="statsStartYear" className="block text-sm font-medium text-secondary-600 mb-2">{t('statsFromYearLabel')}</label>
                                <input id="statsStartYear" type="number" value={statsStartYear} onChange={(e) => setState({ statsStartYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder')} />
                                </div>
                                <div>
                                <label htmlFor="statsEndYear" className="block text-sm font-medium text-secondary-600 mb-2">{t('statsToYearLabel')}</label>
                                <input id="statsEndYear" type="number" value={statsEndYear} onChange={(e) => setState({ statsEndYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder={t('yearPlaceholder2')} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                                    <h4 className="font-semibold text-secondary-700 mb-2">{t('statsByYearTitle')}</h4>
                                    <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('statsByYearDesc')}</p>
                                    <button 
                                    onClick={handleGenerateStatsByYear} 
                                    className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 shadow-md"
                                    >
                                    {t('generateAndDownloadButton')}
                                    </button>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                                    <h4 className="font-semibold text-secondary-700 mb-2">{t('statsSummaryTitle')}</h4>
                                    <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('statsSummaryDesc')}</p>
                                    <button 
                                    onClick={handleGenerateStatsSummary} 
                                    className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 shadow-md"
                                    >
                                    {t('generateAndDownloadButton')}
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}
                        {statsView === 'chart' && (
                            <div className="animate-slide-in-up">
                                <ChartConstructor 
                                    data={results}
                                    columns={chartColumns}
                                    config={{ x: chartConfigX, yCalculation: chartConfigYCalculation, yValueColumn: chartConfigYValueColumn, group: chartConfigGroup, type: chartConfigType, labelDisplay: chartConfigLabelDisplay }}
                                    onConfigChange={handleChartConfigChange as any}
                                    filters={{ x: chartConfigFilterX, group: chartConfigFilterGroup }}
                                    onFilterChange={handleChartFilterChange}
                                />
                            </div>
                        )}
                         {statsView === 'dashboard' && (
                             <div className="animate-slide-in-up">
                                 <Dashboard
                                    data={results}
                                    layouts={dashboardLayouts}
                                    widgets={dashboardWidgets}
                                    onLayoutsChange={(layouts) => setState({ dashboardLayouts: layouts })}
                                    onWidgetsChange={(widgets) => setState({ dashboardWidgets: widgets })}
                                    columns={chartColumns}
                                 />
                             </div>
                         )}
                    </CollapsibleSection>
                </div>
            )}
            
            {results.length > 0 && <DataTable columns={columns} data={results} filename="openalex_publications.xlsx" fixedHeight />}
        </div>
    );
};

export default OpenAlexTab;