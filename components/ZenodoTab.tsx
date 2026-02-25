
import React, { useCallback, useState } from 'react';
import DataTable from './DataTable';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialZenodoState, DashboardWidget } from '../contexts/TabsStateContext';
import { logEvent } from '../services/analyticsService';
import ProgressBar from './ProgressBar';
import ChartConstructor from './ChartConstructor';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import CollapsibleSection from './CollapsibleSection';
import Dashboard from './Dashboard';

export interface ZenodoPublication {
  id: string;
  doi: string;
  title: string;
  authors: string[];
  source: 'Zenodo';
  url: string;
  publicationDate?: string;
  year?: string;
  description?: string;
  keywords?: string[];
  license?: string;
  resourceType?: string;
}

type DisplayZenodoPublication = Omit<ZenodoPublication, 'authors' | 'keywords'> & {
    authors: string;
    keywords: string;
};

const UNIVERSITY_NAME = "Taras Shevchenko National University of Kyiv";
const PAGE_SIZE = 25;
const RATE_LIMIT_DELAY_MS = 1000; // Reduced delay as direct API is often faster

const stripHtml = (html: string | undefined): string => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const mapZenodoRecord = (item: any): ZenodoPublication => ({
    id: item.id.toString(),
    doi: item.doi || item.metadata?.doi || '',
    title: item.metadata.title,
    authors: item.metadata.creators.map((c: any) => c.name),
    source: 'Zenodo' as const,
    url: item.links.html,
    publicationDate: item.metadata.publication_date,
    year: item.metadata.publication_date ? item.metadata.publication_date.substring(0, 4) : undefined,
    description: stripHtml(item.metadata.description),
    keywords: item.metadata.keywords || [],
    license: item.metadata.license?.title || '',
    resourceType: item.metadata.resource_type?.title || '',
});


const ZenodoTab: React.FC = () => {
    const { zenodoState, setZenodoState } = useTabsState();
    const { publications, isLoading, statusText, progress, error, statsStartYear, statsEndYear, chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType, chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay, dashboardLayouts, dashboardWidgets } = zenodoState;
    const [statsView, setStatsView] = useState<'reports' | 'chart' | 'dashboard'>('reports');

    const { t } = useLanguage();

    const setState = (updates: Partial<typeof zenodoState>) => {
        setZenodoState(prev => ({ ...prev, ...updates }));
    };

    const handleReset = () => {
        setZenodoState(initialZenodoState);
    };

    const columns: { header: string; accessor: keyof DisplayZenodoPublication }[] = [
        { header: t('colTitle'), accessor: 'title' },
        { header: t('colAuthors'), accessor: 'authors' },
        { header: t('colYear'), accessor: 'year' },
        { header: t('colDoi'), accessor: 'doi' },
        { header: t('colResourceType'), accessor: 'resourceType' },
        { header: t('colLicense'), accessor: 'license' },
        { header: t('colKeywords'), accessor: 'keywords' },
        { header: t('colUrl'), accessor: 'url' },
    ];

    const handleFetch = useCallback(async () => {
        setState({ isLoading: true, error: null, publications: [], statusText: t('zenodoProgressPrepare'), progress: null });
        logEvent('fetch_data_start', { module: 'zenodo' });

        try {
            let allPublications: ZenodoPublication[] = [];
            let pageCount = 0;
            let totalPages = 0;

            const baseUrl = 'https://zenodo.org/api/records';
            const params = new URLSearchParams({
                q: `metadata.creators.affiliations.name:"${UNIVERSITY_NAME}"`,
                size: PAGE_SIZE.toString(),
                sort: 'mostrecent'
            });
            
            // Direct request without proxy
            let nextUrl: string | null = `${baseUrl}?${params.toString()}`;

            while (nextUrl) {
                pageCount++;
                const response = await fetch(nextUrl);
                
                if (response.status === 429) {
                    throw new Error(t('errorApiRateLimited', { page: pageCount }));
                }
                if (!response.ok) {
                    throw new Error(t('errorApiRequestFailed', { page: pageCount, statusText: response.statusText }));
                }
                
                const result = await response.json();

                if (pageCount === 1 && result.hits.total) {
                    totalPages = Math.ceil(result.hits.total / PAGE_SIZE);
                }

                setState({ 
                    progress: totalPages > 0 ? { current: pageCount, total: totalPages } : null,
                    statusText: t('zenodoProgressFetchingPage', { current: pageCount, total: totalPages > 0 ? ` of ${totalPages}`: '' })
                });

                const rawNextUrl = result.links?.next || null;
                // Direct URL from response
                nextUrl = rawNextUrl;

                const data = result.hits.hits;
                allPublications = [...allPublications, ...data.map(mapZenodoRecord)];
                
                if (nextUrl) {
                    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
                }
            }
            
            const displayData = allPublications.map(p => ({
                ...p,
                authors: p.authors.join('; '),
                keywords: p.keywords?.join('; ') ?? '',
            }));
            
            const defaultWidgets: DashboardWidget[] = [
                { id: 'total_pubs', type: 'total_publications' },
                { id: 'pubs_by_year', type: 'publications_by_year', config: { yearKey: 'year' } },
                { id: 'pubs_by_type', type: 'publications_by_type', config: { typeKey: 'resourceType' } },
            ];
            const defaultLayouts = {
                lg: [
                    { i: 'total_pubs', x: 0, y: 0, w: 4, h: 2 },
                    { i: 'pubs_by_year', x: 0, y: 2, w: 12, h: 4 },
                    { i: 'pubs_by_type', x: 4, y: 0, w: 8, h: 6 },
                ],
            };

            setState({ 
                publications: displayData,
                chartColumns: columns.map(c => ({ accessor: c.accessor as string, header: c.header })),
                statsStartYear: '',
                statsEndYear: '',
                progress: null,
                statusText: t('progressComplete', { count: allPublications.length }),
                dashboardWidgets: defaultWidgets,
                dashboardLayouts: defaultLayouts,
            });
            logEvent('fetch_data_success', { module: 'zenodo', count: allPublications.length });

        } catch (e: any) {
            setState({ error: `${t('errorFetchZenodo')}: ${e.message}`, progress: null, statusText: t('progressFailed') });
            logEvent('fetch_data_error', { module: 'zenodo', error: e.message });
        } finally {
            setState({ isLoading: false });
        }
    }, [t, setZenodoState]);
    
    const getFilteredAndPreppedStats = () => {
      setState({ error: null });
      const yearFilteredResults = publications.filter(pub => {
          if (!pub.year) return false;
          const pubYear = parseInt(pub.year, 10);
          if (isNaN(pubYear)) return false;
          const start = statsStartYear ? parseInt(statsStartYear, 10) : -Infinity;
          const end = statsEndYear ? parseInt(statsEndYear, 10) : Infinity;
          return pubYear >= start && pubYear <= end;
      });

      if (yearFilteredResults.length === 0) {
          setState({ error: t('errorNoPublicationsForYears') });
          return null;
      }
      
      const pubTypes: string[] = [...new Set(yearFilteredResults.map<string>(p => String(p.resourceType || 'N/A')))].sort();
      return { yearFilteredResults, pubTypes };
    };

    const handleGenerateStatsByYear = () => {
        const prep = getFilteredAndPreppedStats();
        if (!prep) return;
        const { yearFilteredResults, pubTypes } = prep;
        
        const statsByYear: { [year: string]: { [type: string]: number } } = {};

        yearFilteredResults.forEach(pub => {
            const year = String(pub.year || 'N/A');
            const type = pub.resourceType || 'N/A';
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
        
        exportObjectsToXlsx(statsData, 'zenodo_stats_by_year.xlsx');
    };

    const handleGenerateStatsSummary = () => {
        const prep = getFilteredAndPreppedStats();
        if (!prep) return;
        const { yearFilteredResults, pubTypes } = prep;

        const stats: { [type: string]: number } = {};
        pubTypes.forEach(type => stats[type] = 0);

        yearFilteredResults.forEach(pub => {
            const type = pub.resourceType || 'N/A';
            stats[type]++;
        });

        const statsData = Object.keys(stats).sort().map(type => ({
            'Publication Type': type,
            'Total Publications': stats[type]
        }));

        exportObjectsToXlsx(statsData, 'zenodo_stats_summary.xlsx');
    };
    
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
                <h2 className="text-xl font-bold text-secondary-800 mb-2">{t('zenodoTitle')}</h2>
                <p className="text-secondary-600">{t('zenodoDescription')} <span className="font-semibold text-primary-800">{UNIVERSITY_NAME}</span>.</p>
                <p className="text-sm text-secondary-500 mt-2">{t('zenodoDisclaimer')}</p>
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
                    onClick={handleFetch}
                    disabled={isLoading}
                    className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg"
                >
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

            {publications.length > 0 && (
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
                                    data={publications}
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
                                    data={publications}
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
            
            {publications.length > 0 && <DataTable columns={columns} data={publications} filename="zenodo_publications.xlsx" fixedHeight />}
        </div>
    );
};

export default ZenodoTab;
