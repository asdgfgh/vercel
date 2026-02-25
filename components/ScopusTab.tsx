
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { fetchAuthorMetrics, fetchAuthorPublications } from '../services/scopusService';
import type { YearRange } from '../types';
import DataTable from './DataTable';
import Loader from './Loader';
import { UploadIcon } from './icons/UploadIcon';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialScopusState, DashboardWidget } from '../contexts/TabsStateContext';
import ProgressBar from './ProgressBar';
import ChartConstructor from './ChartConstructor';
import CollapsibleSection from './CollapsibleSection';
import Dashboard from './Dashboard';
import { logEvent } from '../services/analyticsService';

declare const XLSX: any;

const addAuthorAffiliationStatus = (results: any[]): any[] => {
    const authorKnuAffiliation = new Map<string, boolean>();
    for (const pub of results) {
        if (pub.affil_knu) {
            authorKnuAffiliation.set(pub.author_scopus, true);
        }
    }
    return results.map(pub => ({
        ...pub,
        author_has_knu_affil: authorKnuAffiliation.get(pub.author_scopus) || false
    }));
};


const ScopusTab: React.FC = () => {
  const { scopusState, setScopusState } = useTabsState();
  const {
    apiKey, authorIds, startYear, endYear, file, fileName, results, isLoading, error, statusText, progress,
    fileHeaders, sourceColumn, originalData, groupingColumn, statsStartYear, statsEndYear,
    isFilterEnabled, filterColumn, uniqueFilterValues, selectedFilterValues,
    chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType,
    chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay,
    dashboardLayouts, dashboardWidgets
  } = scopusState;

  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statsView, setStatsView] = useState<'reports' | 'chart' | 'dashboard'>('reports');
  
  const setState = (updates: Partial<typeof scopusState>) => {
    setScopusState(prev => ({ ...prev, ...updates }));
  };

  const simpleColumns = useMemo(() => [
    { header: t('colAuthorScopusId'), accessor: 'author_scopus' },
    { header: t('colAuthorHasKnuAffil'), accessor: 'author_has_knu_affil' },
    { header: t('colPublicationScopusId'), accessor: 'eid' },
    { header: t('colHIndex'), accessor: 'h_index' },
    { header: t('colTitle'), accessor: 'title' },
    { header: t('colJournal'), accessor: 'journal' },
    { header: t('colJournalId'), accessor: 'journal_id' },
    { header: t('colYear'), accessor: 'year' },
    { header: t('colDoi'), accessor: 'doi' },
    { header: t('colType'), accessor: 'pub_type' },
    { header: t('colCitations'), accessor: 'citedby_count' },
    { header: t('colVolume'), accessor: 'volume' },
    { header: t('colIssue'), accessor: 'issue' },
    { header: t('colPages'), accessor: 'pages' },
    { header: t('colIssn'), accessor: 'issn' },
    { header: t('colEissn'), accessor: 'eissn' },
    { header: t('colOpenAccess'), accessor: 'open_access' },
    { header: t('colAffilKnu'), accessor: 'affil_knu' },
    { header: t('colAffilRf'), accessor: 'affil_rf' },
  ], [t]);

  useEffect(() => {
    if (filterColumn && originalData.length > 0) {
        const values = new Set<string>();
        originalData.forEach(row => {
            const value = row[filterColumn];
            if (value !== null && value !== undefined && String(value).trim() !== '') {
                values.add(String(value).trim());
            }
        });
        const sortedValues = Array.from(values).sort();
        setState({ uniqueFilterValues: sortedValues, selectedFilterValues: [] });
    } else {
        setState({ uniqueFilterValues: [], selectedFilterValues: [] });
    }
  }, [filterColumn, originalData]);

  const handleReset = () => {
    setScopusState({ ...initialScopusState, apiKey: scopusState.apiKey });
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const parseExcel = (file: File): Promise<{ headers: string[]; data: Record<string, any>[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length < 1 || jsonData[0].length < 1) {
                    resolve({ headers: [], data: [] });
                    return;
                }
                const headers = jsonData[0].map(String);
                const dataObjects = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

                resolve({ headers, data: dataObjects });
            } catch (e: any) {
                reject(new Error(`${t('errorExcelParse')}: ${e.message}`));
            }
        };
        reader.onerror = (error) => reject(new Error(`${t('errorFileRead')}: ${error}`));
        reader.readAsBinaryString(file);
    });
  };

  const handleFetch = useCallback(async () => {
    if (!apiKey) {
      setState({ error: t('errorApiKeyRequired') });
      return;
    }

    const yearRange: YearRange = {
      start: startYear ? parseInt(startYear) : undefined,
      end: endYear ? parseInt(endYear) : undefined,
    };

    setState({ isLoading: true, error: null, results: [], statusText: '', progress: null });

    logEvent('fetch_data_start', { module: 'scopus' });

    try {
        const allResults: Record<string, any>[] = [];
        let idCount = 0;
      
        if (file) {
          if (!sourceColumn) {
              setState({ error: t('errorSelectSourceColumn'), isLoading: false });
              return;
          }

          const dataToProcess = (isFilterEnabled && selectedFilterValues.length > 0)
              ? originalData.filter(row => selectedFilterValues.includes(String(row[filterColumn]).trim()))
              : originalData;

          idCount = dataToProcess.length;

          if (dataToProcess.length === 0) {
              setState({ error: t('errorNoRowsAfterFilter'), isLoading: false });
              return;
          }

          logEvent('data_fetched', {
              module: 'scopus',
              source: 'file',
              id_count: idCount,
              year_range: `${startYear}-${endYear}`,
              is_filtered: isFilterEnabled
          });
          
          for (let i = 0; i < dataToProcess.length; i++) {
              const rowData = dataToProcess[i];
              const authorId = rowData[sourceColumn]?.toString().trim();
              const authorName = rowData['Автор'] || `ID: ${authorId}`;
              setState({ 
                  progress: { current: i + 1, total: dataToProcess.length },
                  statusText: t('progressProcessingAuthor', { current: i + 1, total: dataToProcess.length, author: authorName })
              });
              
              if (!authorId) continue;

              try {
                const { hIndex } = await fetchAuthorMetrics(authorId, apiKey);
                const publications = await fetchAuthorPublications(authorId, apiKey, yearRange);
                
                if (publications.length > 0) {
                    const publicationsWithMeta = publications.map(pub => ({
                        ...rowData,
                        ...pub,
                        author_scopus: authorId,
                        h_index: hIndex,
                    }));
                    allResults.push(...publicationsWithMeta);
                } else {
                     allResults.push({
                        ...rowData,
                        author_scopus: authorId,
                        h_index: hIndex,
                        eid: '', title: t('infoNoPublications'), doi: '', year: '', pub_type: '', journal: '', journal_id: '', pages: '', volume: '', issue: '', issn: '', eissn: '', open_access: '', citedby_count: '', affil_knu: false, affil_rf: false
                    });
                }
              } catch (err: any) {
                console.error(`Error processing Scopus ID ${authorId}: ${err.message}`);
                allResults.push({ ...rowData, title: `${t('errorFetchFailed')}: ${err.message}` });
                if (err.message.includes("invalid characters")) {
                    throw err;
                }
              }
          }
          
        } else {
          const ids = authorIds.split('\n').map(id => id.trim()).filter(Boolean);
          idCount = ids.length;

          if (ids.length === 0) {
            setState({ error: t('errorNoAuthorIds'), isLoading: false });
            return;
          }
          
          logEvent('data_fetched', {
            module: 'scopus',
            source: 'manual',
            id_count: idCount,
            year_range: `${startYear}-${endYear}`
          });

          for (let i = 0; i < ids.length; i++) {
            const authorId = ids[i];
            setState({
              progress: { current: i + 1, total: ids.length },
              statusText: t('progressProcessingAuthor', { current: i + 1, total: ids.length, author: authorId }),
            });
            try {
              const { hIndex } = await fetchAuthorMetrics(authorId, apiKey);
              const publications = await fetchAuthorPublications(authorId, apiKey, yearRange);
              const publicationsWithMeta = publications.map(pub => ({
                  ...pub,
                  author_scopus: authorId,
                  h_index: hIndex,
              }));
              allResults.push(...publicationsWithMeta as any[]);
            } catch (err: any) {
              console.error(`Error processing Scopus ID ${authorId}: ${err.message}`);
              allResults.push({
                  author_scopus: authorId,
                  title: `${t('errorFetchFailed')}: ${err.message}`,
                  h_index: null, eid: '', doi: '', year: '', pub_type: 'ERROR', journal: '', journal_id: '', pages: '', volume: '', issue: '', issn: '', eissn: '', open_access: '', citedby_count: '', affil_knu: false, affil_rf: false
              });

              if (err.message.includes("invalid characters")) {
                  throw err;
              }
            }
          }
        }
      
      const finalResults = addAuthorAffiliationStatus(allResults);
      const currentColumns = file ? [...fileHeaders.map(h => ({ header: h, accessor: h })), ...simpleColumns.filter(c => c.accessor !== 'author_scopus')] : simpleColumns;
      
      const uniqueColumns = currentColumns.filter((v,i,a)=>a.findIndex(t=>(t.accessor === v.accessor))===i);

      const defaultWidgets: DashboardWidget[] = [
            { id: 'total_pubs', type: 'total_publications' },
            { id: 'unique_authors', type: 'unique_authors', config: { authorKey: 'author_scopus' } },
            { id: 'pubs_by_year', type: 'publications_by_year', config: { yearKey: 'year' } },
            { id: 'pubs_by_type', type: 'publications_by_type', config: { typeKey: 'pub_type' } },
        ];
        const defaultLayouts = {
            lg: [
                { i: 'total_pubs', x: 0, y: 0, w: 3, h: 2 },
                { i: 'unique_authors', x: 3, y: 0, w: 3, h: 2 },
                { i: 'pubs_by_year', x: 0, y: 2, w: 6, h: 4 },
                { i: 'pubs_by_type', x: 6, y: 0, w: 6, h: 6 },
            ],
        };

      setState({
          results: finalResults,
          chartColumns: uniqueColumns,
          statsStartYear: startYear,
          statsEndYear: endYear,
          progress: null,
          statusText: t('progressComplete', { count: allResults.length }),
          dashboardWidgets: defaultWidgets,
          dashboardLayouts: defaultLayouts,
      });

      logEvent('fetch_data_success', { module: 'scopus', count: finalResults.length });

    } catch (err: any) {
      setState({ error: `${t('errorFetchFailed')}: ${err.message}`, progress: null, statusText: t('progressFailed') });
      logEvent('error', { module: 'scopus', action: 'fetch_data', message: err.message });
    } finally {
      setState({ isLoading: false });
    }
  }, [apiKey, authorIds, startYear, endYear, file, t, sourceColumn, originalData, isFilterEnabled, filterColumn, selectedFilterValues, simpleColumns]);
  
  const columns = useMemo(() => {
    if (file && fileHeaders.length > 0) {
        const originalColumns = fileHeaders.map(h => ({ header: h, accessor: h }));
        const publicationColumns = simpleColumns.filter(c => c.accessor !== 'author_scopus');
        return [...originalColumns, ...publicationColumns];
    }
    return simpleColumns;
  }, [file, fileHeaders, simpleColumns]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        handleReset();
        setState({ file: selectedFile, fileName: selectedFile.name });
        try {
            const { headers, data } = await parseExcel(selectedFile);
            if (headers.length > 0) {
                const scopusHeader = headers.find(h => h.toUpperCase() === 'SCOPUS');
                setState({
                    fileHeaders: headers,
                    originalData: data,
                    sourceColumn: scopusHeader || headers[0],
                    groupingColumn: headers[0],
                    filterColumn: headers[0],
                });
            } else {
                setState({ error: t('apaErrorEmptyFile'), file: null, fileName: '' });
            }
        } catch (err: any) {
            setState({ error: err.message, file: null, fileName: '' });
        }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleReset();
    setState({ authorIds: e.target.value });
  }
  
  const handleFilterValueChange = (value: string) => {
    setState({
        selectedFilterValues: selectedFilterValues.includes(value)
            ? selectedFilterValues.filter(v => v !== value)
            : [...selectedFilterValues, value]
    });
  };

  const handleSelectAllFilters = () => {
      setState({ selectedFilterValues: uniqueFilterValues });
  };

  const handleDeselectAllFilters = () => {
      setState({ selectedFilterValues: [] });
  };

  const getFilteredAndPreppedStats = () => {
      setState({ error: null });
      const yearFilteredResults = results.filter(pub => {
          if (!pub.year) return false;
          const pubYear = parseInt(pub.year, 10);
          if (isNaN(pubYear)) return false;
          const start = statsStartYear ? parseInt(statsStartYear, 10) : -Infinity;
          const end = statsEndYear ? parseInt(statsEndYear, 10) : Infinity;
          return pubYear >= start && pubYear <= end;
      });

      const knuAffiliatedResults = yearFilteredResults.filter(pub => pub.affil_knu && !pub.affil_rf);

      if (knuAffiliatedResults.length === 0) {
          setState({ error: t('errorNoKnuPublications') });
          return null;
      }

      const pubTypes: string[] = [...new Set(knuAffiliatedResults.map<string>(p => String(p.pub_type || 'N/A')))].sort();
      return { knuAffiliatedResults, pubTypes };
  }

  const handleGenerateAuthorStatsByYear = () => {
      const prep = getFilteredAndPreppedStats();
      if (!prep) return;
      const { knuAffiliatedResults, pubTypes } = prep;
      
      const statsData: Record<string, any>[] = [];

      if (file) {
          const pubsByAuthorId = new Map<string, Record<string, any>[]>();
          knuAffiliatedResults.forEach(pub => {
              const authorId = pub.author_scopus;
              if (!authorId) return;
              if (!pubsByAuthorId.has(authorId)) {
                  pubsByAuthorId.set(authorId, []);
              }
              pubsByAuthorId.get(authorId)!.push(pub);
          });

          originalData.forEach(authorRow => {
              const authorId = authorRow[sourceColumn]?.toString().trim();
              const authorPubs = pubsByAuthorId.get(authorId) || [];
              if (authorPubs.length === 0) return;

              const pubsByYear = new Map<string, Record<string, any>[]>();
              authorPubs.forEach(pub => {
                  const year = pub.year || 'N/A';
                  if (!pubsByYear.has(year)) pubsByYear.set(year, []);
                  pubsByYear.get(year)!.push(pub);
              });
              
              const sortedYears: string[] = Array.from(pubsByYear.keys()).sort();
              
              sortedYears.forEach(year => {
                  const yearPubs = pubsByYear.get(year)!;
                  const stats: { [key: string]: number } = {};
                  pubTypes.forEach(type => { stats[type] = 0; });
                  yearPubs.forEach(pub => {
                      const type = String(pub.pub_type || 'N/A');
                      if (stats.hasOwnProperty(type)) stats[type]++;
                  });
                  
                  const totalCount = yearPubs.length;
                  const rowWithStats: Record<string, any> = { ...authorRow, 'Year': year, 'Total KNU Publications': totalCount };
                  pubTypes.forEach(type => { rowWithStats[type] = stats[type]; });
                  statsData.push(rowWithStats);
              });
          });
      } else {
          const authorIds = [...new Set(knuAffiliatedResults.map(p => p.author_scopus))];
          authorIds.forEach(authorId => {
              const authorPubs = knuAffiliatedResults.filter(p => p.author_scopus === authorId);
              const hIndex = authorPubs[0]?.h_index || '';

              const pubsByYear = new Map<string, Record<string, any>[]>();
              authorPubs.forEach(pub => {
                  const year = pub.year || 'N/A';
                  if (!pubsByYear.has(year)) pubsByYear.set(year, []);
                  pubsByYear.get(year)!.push(pub);
              });

              const sortedYears: string[] = Array.from(pubsByYear.keys()).sort();

              sortedYears.forEach(year => {
                  const yearPubs = pubsByYear.get(year)!;
                  const stats: { [key: string]: number } = {};
                  pubTypes.forEach(type => { stats[type] = 0; });
                  yearPubs.forEach(pub => {
                      const type = String(pub.pub_type || 'N/A');
                      if (stats.hasOwnProperty(type)) stats[type]++;
                  });
                  const totalCount = yearPubs.length;
                  const rowWithStats: Record<string, any> = { 'Scopus Author ID': authorId, 'h-index': hIndex, 'Year': year, 'Total KNU Publications': totalCount };
                  pubTypes.forEach(type => { rowWithStats[type] = stats[type]; });
                  statsData.push(rowWithStats);
              });
          });
      }
      
      exportObjectsToXlsx(statsData, 'scopus_author_stats_by_year_knu.xlsx');
      logEvent('report_generated', { module: 'scopus', report_type: 'author_by_year' });
  };

  const handleGenerateGroupedStats = () => {
      if (!groupingColumn) { setState({ error: t('errorNoGroupingColumn') }); return; }
      const prep = getFilteredAndPreppedStats();
      if (!prep) return;
      const { knuAffiliatedResults, pubTypes } = prep;

      const groupedPubs = new Map<string, Record<string, any>[]>();
      knuAffiliatedResults.forEach(pub => {
          const groupValue = pub[groupingColumn]?.toString() || 'N/A';
          if (!groupedPubs.has(groupValue)) groupedPubs.set(groupValue, []);
          groupedPubs.get(groupValue)!.push(pub);
      });

      const statsData: Record<string, any>[] = [];
      groupedPubs.forEach((pubs, groupValue) => {
          const row: { [key: string]: string | number } = {};
          row[groupingColumn] = groupValue;

          const stats: { [key: string]: number } = {};
          pubTypes.forEach(type => { stats[type] = 0; });
          pubs.forEach(pub => {
              const type = String(pub.pub_type || 'N/A');
              if (stats.hasOwnProperty(type)) stats[type]++;
          });
          
          pubTypes.forEach(type => { row[type] = stats[type]; });
          row['Total Publications'] = pubs.length;
          statsData.push(row);
      });
      
      statsData.sort((a, b) => a[groupingColumn] > b[groupingColumn] ? 1 : -1);
      
      exportObjectsToXlsx(statsData, `scopus_grouped_stats_total_by_${groupingColumn}.xlsx`);
      logEvent('report_generated', { module: 'scopus', report_type: 'grouped_summary', group_by: groupingColumn });
  };

  const handleGenerateGroupedStatsByYear = () => {
      if (!groupingColumn) { setState({ error: t('errorNoGroupingColumn') }); return; }
      const prep = getFilteredAndPreppedStats();
      if (!prep) return;
      const { knuAffiliatedResults, pubTypes } = prep;

      const groupedPubs = new Map<string, Record<string, any>[]>();
      knuAffiliatedResults.forEach(pub => {
          const groupValue = pub[groupingColumn]?.toString() || 'N/A';
          if (!groupedPubs.has(groupValue)) groupedPubs.set(groupValue, []);
          groupedPubs.get(groupValue)!.push(pub);
      });

      const statsData: Record<string, any>[] = [];
      groupedPubs.forEach((pubs, groupValue) => {
          const pubsByYear = new Map<string, Record<string, any>[]>();
          pubs.forEach(pub => {
              const year = pub.year || 'N/A';
              if (!pubsByYear.has(year)) pubsByYear.set(year, []);
              pubsByYear.get(year)!.push(pub);
          });
          
          const sortedYears: string[] = Array.from(pubsByYear.keys()).sort();

          sortedYears.forEach(year => {
              const yearPubs = pubsByYear.get(year)!;
              const row: { [key: string]: string | number } = {};
              row[groupingColumn] = groupValue;
              row['Year'] = year;

              const stats: { [key: string]: number } = {};
              pubTypes.forEach(type => { stats[type] = 0; });
              yearPubs.forEach(pub => {
                  const type = String(pub.pub_type || 'N/A');
                  if (stats.hasOwnProperty(type)) stats[type]++;
              });
              
              pubTypes.forEach(type => { row[type] = stats[type]; });
              row['Total Publications'] = yearPubs.length;
              statsData.push(row);
          });
      });
      
      statsData.sort((a, b) => {
        const valA = a[groupingColumn];
        const valB = b[groupingColumn];
        if (valA > valB) return 1;
        if (valA < valB) return -1;
        const yearA = a['Year'];
        const yearB = b['Year'];
        if (yearA > yearB) return 1;
        if (yearA < yearB) return -1;
        return 0;
      });
      
      exportObjectsToXlsx(statsData, `scopus_grouped_stats_by_year_by_${groupingColumn}.xlsx`);
      logEvent('report_generated', { module: 'scopus', report_type: 'grouped_by_year', group_by: groupingColumn });
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
  }

   const handleChartFilterChange = (key: 'x' | 'group', value: string[] | null) => {
    const newFilters = { [`chartConfigFilter${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
    setState(newFilters as any);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-secondary-600 mb-2">{t('apiKeyLabel')}</label>
          <input id="apiKey" type="password" value={apiKey} onChange={(e) => setState({ apiKey: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('apiKeyPlaceholder')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startYear" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
              <input id="startYear" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder')} />
            </div>
            <div>
              <label htmlFor="endYear" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
              <input id="endYear" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder2')} />
            </div>
        </div>
          <>
            <div>
                <label htmlFor="authorIds" className="block text-sm font-medium text-secondary-600 mb-2">{t('authorIdsLabel')}</label>
                <textarea id="authorIds" value={authorIds} onChange={handleTextareaChange} rows={4} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder="57211831518&#10;7004218739" disabled={!!file} />
            </div>
            <div>
                <label htmlFor="excelFile" className="block text-sm font-medium text-secondary-600 mb-2">{t('uploadExcelLabel')}</label>
                <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-secondary-300 border-dashed rounded-lg h-full bg-secondary-50 hover:bg-secondary-100 hover:border-primary-400 transition-colors duration-200 group">
                    <div className="space-y-1 text-center">
                         <div className="w-12 h-12 mx-auto text-secondary-400 group-hover:text-primary-600 transition-colors">
                            <UploadIcon />
                         </div>
                        <div className="flex text-sm text-secondary-600 justify-center">
                            <label htmlFor="excelFile" className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-800 focus-within:outline-none">
                                <span>{t('uploadFileLink')}</span>
                                <input id="excelFile" name="excelFile" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} ref={fileInputRef} />
                            </label>
                            <p className="pl-1">{t('dragAndDrop')}</p>
                        </div>
                        {fileName && <p className="text-sm text-green-600 mt-2">{t('selectedFile')}: {fileName}</p>}
                    </div>
                </div>
            </div>
            {file && fileHeaders.length > 0 && (
              <div className="md:col-span-2 space-y-4 animate-slide-in-up">
                <div>
                    <label htmlFor="sourceColumnScopus" className="block text-sm font-medium text-secondary-600 mb-2">
                    {t('selectIdColumnLabelScopus')}
                    </label>
                    <select
                    id="sourceColumnScopus"
                    value={sourceColumn}
                    onChange={(e) => setState({ sourceColumn: e.target.value })}
                    className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                    {fileHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                    ))}
                    </select>
                </div>
                <div className="p-4 border border-secondary-200 rounded-lg bg-secondary-50/50">
                    <div className="flex items-center">
                        <input
                            id="enable-filter-scopus"
                            type="checkbox"
                            checked={isFilterEnabled}
                            onChange={(e) => setState({ isFilterEnabled: e.target.checked })}
                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="enable-filter-scopus" className="ml-2 block text-sm font-semibold text-secondary-800">
                            {t('enableFilterLabel')}
                        </label>
                    </div>

                    {isFilterEnabled && (
                        <div className="mt-4 space-y-4 animate-slide-in-up">
                            <div>
                                <label htmlFor="filter-column-scopus" className="block text-sm font-medium text-secondary-600 mb-2">
                                    {t('selectFilterColumnLabel')}
                                </label>
                                <select
                                    id="filter-column-scopus"
                                    value={filterColumn}
                                    onChange={(e) => setState({ filterColumn: e.target.value })}
                                    className="w-full bg-white border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                    {fileHeaders.map(header => (
                                        <option key={header} value={header}>{header}</option>
                                    ))}
                                </select>
                            </div>

                            {uniqueFilterValues.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-secondary-600 mb-2">
                                        {t('selectFilterValuesLabel')}
                                    </label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button onClick={handleSelectAllFilters} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}</button>
                                        <span className="text-secondary-300">|</span>
                                        <button onClick={handleDeselectAllFilters} className="text-xs font-semibold text-primary-600 hover:underline">{t('deselectAll')}</button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto border border-secondary-300 rounded-lg p-2 bg-white space-y-1">
                                        {uniqueFilterValues.map(value => (
                                            <div key={value} className="flex items-center p-1 hover:bg-primary-50 rounded">
                                                <input
                                                    id={`scopus-filter-val-${value}`}
                                                    type="checkbox"
                                                    checked={selectedFilterValues.includes(value)}
                                                    onChange={() => handleFilterValueChange(value)}
                                                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <label htmlFor={`scopus-filter-val-${value}`} className="ml-2 block text-sm text-secondary-700 truncate cursor-pointer flex-1">{value}</label>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-secondary-500 mt-1">{t('filterSelectionInfo', { selected: selectedFilterValues.length, total: uniqueFilterValues.length })}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              </div>
            )}
          </>
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
                disabled={isLoading || (file && !sourceColumn)}
                className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg"
            >
                {isLoading ? <Loader /> : t('fetchDataButton')}
            </button>
        </div>
      
      {isLoading && progress && (
        <div className="mb-6">
          <ProgressBar current={progress.current} total={progress.total} text={statusText} />
        </div>
      )}
      {!isLoading && statusText && !error && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-6">
            {statusText}
        </div>
      )}
      {error && <ErrorMessage message={error} />}
      
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
                      <input id="statsStartYear" type="number" value={statsStartYear} onChange={(e) => setState({ statsStartYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder')} />
                      </div>
                      <div>
                      <label htmlFor="statsEndYear" className="block text-sm font-medium text-secondary-600 mb-2">{t('statsToYearLabel')}</label>
                      <input id="statsEndYear" type="number" value={statsEndYear} onChange={(e) => setState({ statsEndYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder2')} />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                    <h4 className="font-semibold text-secondary-700 mb-2">{t('authorStatsTitleByYear')}</h4>
                    <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('authorStatsDescriptionByYear')}</p>
                    <button 
                      onClick={handleGenerateAuthorStatsByYear} 
                      className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:from-secondary-400 disabled:to-secondary-500 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                    >
                      {t('generateAndDownloadButton')}
                    </button>
                  </div>
                  
                  {fileHeaders.length > 0 && (
                    <>
                      <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                        <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleTotal')}</h4>
                        <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionTotal')}</p>
                        <div className="mb-4">
                          <label htmlFor="grouping-column-total" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                          <select 
                            id="grouping-column-total" 
                            value={groupingColumn} 
                            onChange={(e) => setState({ groupingColumn: e.target.value })} 
                            className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm"
                          >
                            {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <button 
                          onClick={handleGenerateGroupedStats} 
                          disabled={!groupingColumn} 
                          className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:from-secondary-400 disabled:to-secondary-500 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                        >
                          {t('generateAndDownloadButton')}
                        </button>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                        <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleByYear')}</h4>
                        <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionByYear')}</p>
                        <div className="mb-4">
                          <label htmlFor="grouping-column-by-year" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                          <select 
                            id="grouping-column-by-year" 
                            value={groupingColumn} 
                            onChange={(e) => setState({ groupingColumn: e.target.value })} 
                            className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm"
                          >
                            {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <button 
                          onClick={handleGenerateGroupedStatsByYear} 
                          disabled={!groupingColumn} 
                          className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:from-secondary-400 disabled:to-secondary-500 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                        >
                          {t('generateAndDownloadButton')}
                        </button>
                      </div>
                    </>
                  )}
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

      {results.length > 0 && <DataTable columns={columns as any} data={results} filename="scopus_publications.xlsx" fixedHeight />}
    </div>
  );
};

export default ScopusTab;
