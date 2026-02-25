import React, { useRef, useEffect, useState, useMemo } from 'react';
import { fetchAndProcessOrcidWorks } from '../services/orcidService';
import type { YearRange, EnabledMetadataServices } from '../types';
import DataTable from './DataTable';
import Loader from './Loader';
import { UploadIcon } from './icons/UploadIcon';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialOrcidState, DashboardWidget } from '../contexts/TabsStateContext';
import ProgressBar from './ProgressBar';
import ChartConstructor from './ChartConstructor';
import { jaroWinkler, normalizeTitleForComparison } from '../utils/jaroWinkler';
import { DownloadIcon } from './icons/DownloadIcon';
import InteractiveReview from './InteractiveReview';
import CollapsibleSection from './CollapsibleSection';
import Dashboard from './Dashboard';

declare const XLSX: any;

const normalizeDoi = (doi: string | null | undefined): string | null => {
    if (!doi) return null;
    return doi.toLowerCase().replace("https://doi.org/", "").trim();
};

const OrcidTab: React.FC = () => {
  const { orcidState, setOrcidState } = useTabsState();
  const {
    orcidIds, startYear, endYear, file, fileName, results, isLoading, error, statusText, progress,
    fileHeaders, sourceColumn, originalData, groupingColumn, statsStartYear, statsEndYear,
    enabledServices, isFilterEnabled, filterColumn, uniqueFilterValues, selectedFilterValues,
    // Fix: Replace chartConfigY with chartConfigYCalculation and chartConfigYValueColumn
    chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType,
    chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay,
    deduplicationMethod, manualReviewList, deduplicationLog, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold, processStats,
    reviewIndex, reviewGroups,
    dashboardLayouts, dashboardWidgets
  } = orcidState;

  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statsView, setStatsView] = useState<'reports' | 'chart' | 'dashboard'>('reports');

  const setState = (updates: Partial<typeof orcidState>) => {
    setOrcidState(prev => ({ ...prev, ...updates }));
  };

  const simpleColumns = useMemo(() => [
    { header: t('colOrcid'), accessor: 'orcid' }, { header: t('colOrcidPutCode'), accessor: 'put_code' }, { header: t('colTitle'), accessor: 'title' }, { header: t('colYear'), accessor: 'year' }, { header: t('colJournal'), accessor: 'journal' }, { header: t('colVolume'), accessor: 'volume' }, { header: t('colIssue'), accessor: 'issue' }, { header: t('colPages'), accessor: 'pages' }, { header: t('colDoi'), accessor: 'doi' }, { header: t('colIssn'), accessor: 'issn' }, { header: t('colEissn'), accessor: 'eissn' }, { header: t('colType'), accessor: 'type' }, { header: t('colSource'), accessor: 'sours' },
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
    setOrcidState(initialOrcidState);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleServiceToggle = (service: keyof EnabledMetadataServices) => {
    setState({
      enabledServices: {
        ...enabledServices,
        [service]: !enabledServices[service]
      }
    });
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
    const yearRange: YearRange = {
      start: startYear ? parseInt(startYear) : undefined,
      end: endYear ? parseInt(endYear) : undefined,
    };

    setState({ isLoading: true, error: null, results: [], statusText: '', progress: null, manualReviewList: [], processStats: null, deduplicationLog: [], reviewIndex: -1, reviewGroups: [] });

    logEvent('fetch_data_start', { module: 'orcid' });

    try {
      const allResults: any[] = [];
      const allReviewGroups: any[][] = [];
      const allDedupLogs: any[] = [];
      let totalOrcidInitial = 0;

      const getPriority = (pub: any) => {
          const ORCID_SOURCE_PRIORITY: { [key: string]: number } = {
              "Web of Science Researcher Profile Sync": 1,
              "Scopus - Elsevier": 2,
              "Other": 3,
              "author": 10
          };
          return ORCID_SOURCE_PRIORITY[pub.sours] || 99;
      };

      const processSingleAuthor = async (orcidId: string, rowData: Record<string, any> = {}) => {
          const works = await fetchAndProcessOrcidWorks(orcidId, yearRange, enabledServices);
          totalOrcidInitial += works.length;

          let finalPubsForAuthor: any[] = [];
          const dedupLogForAuthor: any[] = [];
          
          const mappedWorks = works.map(w => ({ ...w, _id: `o_${w.put_code || Math.random().toString(36).substring(2)}`}));

          if (mappedWorks.length > 0) {
              const duplicatesToRemove = new Set<string>();
              const potentialReviewItems: {item1: any, item2: any, score: number}[] = [];

              for (let i = 0; i < mappedWorks.length; i++) {
                  if (duplicatesToRemove.has(mappedWorks[i]._id)) continue;
                  for (let j = i + 1; j < mappedWorks.length; j++) {
                      if (duplicatesToRemove.has(mappedWorks[j]._id)) continue;

                      const pub1 = mappedWorks[i];
                      const pub2 = mappedWorks[j];
                      let isDuplicate = false;
                      let needsReview = false;
                      let similarityScore = 0;

                      const doi1 = normalizeDoi(pub1.doi);
                      const doi2 = normalizeDoi(pub2.doi);
                      const title1Norm = normalizeTitleForComparison(pub1.title);
                      const title2Norm = normalizeTitleForComparison(pub2.title);

                      if (doi1 && doi2 && doi1 === doi2) {
                          isDuplicate = true;
                      } else if (deduplicationMethod === 'standard') {
                          if (title1Norm && title2Norm && title1Norm.length > 0 && title1Norm === title2Norm) {
                              isDuplicate = true;
                          }
                      } else { // advanced
                          if (title1Norm && title2Norm && title1Norm.length > 0 && title2Norm.length > 0) {
                              similarityScore = jaroWinkler(title1Norm, title2Norm);
                              if (similarityScore > (jaroWinklerMatchThreshold / 100)) {
                                  isDuplicate = true;
                              } else if (similarityScore > (jaroWinklerReviewThreshold / 100)) {
                                  needsReview = true;
                              }
                          }
                      }

                      if (isDuplicate) {
                          const [keep, remove] = getPriority(pub1) <= getPriority(pub2) ? [pub1, pub2] : [pub2, pub1];
                          if (!duplicatesToRemove.has(remove._id)) {
                              duplicatesToRemove.add(remove._id);
                              const { _id: _removedId, ...logData } = remove;
                              dedupLogForAuthor.push({
                                  ...logData,
                                  [t('colReasonForRemoval')]: `Duplicate by title/DOI match.`,
                                  [t('colDuplicateOfTitle')]: keep.title,
                                  [t('colDuplicateOfDOI')]: keep.doi,
                              });
                          }
                      } else if (needsReview) {
                           potentialReviewItems.push({item1: pub1, item2: pub2, score: similarityScore});
                      }
                  }
              }
              
              if (potentialReviewItems.length > 0) {
                  const adj = new Map<string, any[]>();
                  const nodeMap = new Map<string, any>();
              
                  potentialReviewItems.forEach(({item1, item2, score}) => {
                      if (!adj.has(item1._id)) adj.set(item1._id, []);
                      if (!adj.has(item2._id)) adj.set(item2._id, []);
                      adj.get(item1._id)!.push(item2);
                      adj.get(item2._id)!.push(item1);
              
                      nodeMap.set(item1._id, {...item1, [t('colSimilarity')]: `${(score * 100).toFixed(1)}%`});
                      nodeMap.set(item2._id, {...item2, [t('colSimilarity')]: `${(score * 100).toFixed(1)}%`});
                  });
              
                  const visited = new Set<string>();
                  for (const nodeId of nodeMap.keys()) {
                      if (!visited.has(nodeId)) {
                          const currentGroup: any[] = [];
                          const queue: string[] = [nodeId];
                          visited.add(nodeId);
              
                          while (queue.length > 0) {
                              const currentNodeId = queue.shift()!;
                              currentGroup.push(nodeMap.get(currentNodeId));
              
                              const neighbors = adj.get(currentNodeId) || [];
                              for (const neighbor of neighbors) {
                                  if (!visited.has(neighbor._id)) {
                                      visited.add(neighbor._id);
                                      queue.push(neighbor._id);
                                  }
                              }
                          }
                          allReviewGroups.push(currentGroup.map(item => ({...rowData, ...item})));
                      }
                  }
              }

              finalPubsForAuthor = mappedWorks.filter(p => !duplicatesToRemove.has(p._id));
          }

          if (dedupLogForAuthor.length > 0) allDedupLogs.push(...dedupLogForAuthor.map(logEntry => ({ ...rowData, ...logEntry })));

          if (finalPubsForAuthor.length > 0) {
              allResults.push(...finalPubsForAuthor.map(pub => ({ ...rowData, ...pub })));
          } else if (works.length === 0) {
              allResults.push({ ...rowData, orcid: orcidId, title: t('infoNoPublications') });
          }
      };

      if (file) {
        if (!sourceColumn) {
            setState({ error: t('errorSelectSourceColumn'), isLoading: false }); return;
        }

        const dataToProcess = (isFilterEnabled && selectedFilterValues.length > 0)
            ? originalData.filter(row => selectedFilterValues.includes(String(row[filterColumn]).trim()))
            : originalData;

        if (dataToProcess.length === 0) {
            setState({ error: t('errorNoRowsAfterFilter'), isLoading: false }); return;
        }
        
        for (let i = 0; i < dataToProcess.length; i++) {
            const rowData = dataToProcess[i];
            const orcidId = rowData[sourceColumn]?.toString().trim();
            const authorName = rowData['Автор'] || `ID: ${orcidId}`;
            setState({ progress: { current: i + 1, total: dataToProcess.length }, statusText: t('progressProcessingAuthor', { current: i + 1, total: dataToProcess.length, author: authorName }) });
            
            if (!orcidId) continue;
            
            try {
              await processSingleAuthor(orcidId, rowData);
            } catch (err: any) {
              console.error(`Error processing ORCID ${orcidId}: ${err.message}`);
              allResults.push({ ...rowData, title: `${t('errorFetchFailed')}: ${err.message}` });
            }
        }
      } else {
        const ids = orcidIds.split('\n').map(id => id.trim()).filter(Boolean);
        if (ids.length === 0) {
          setState({ error: t('errorNoOrcidIds'), isLoading: false }); return;
        }

        for (let i = 0; i < ids.length; i++) {
          const orcidId = ids[i];
          setState({ progress: { current: i + 1, total: ids.length }, statusText: t('progressProcessingAuthor', { current: i + 1, total: ids.length, author: orcidId }) });
          try {
            await processSingleAuthor(orcidId, { orcid: orcidId });
          } catch (err: any) {
            console.error(`Error processing ORCID ${orcidId}: ${err.message}`);
             allResults.push({ orcid: orcidId, title: `${t('errorFetchFailed')}: ${err.message}` });
          }
        }
      }

      const allColumns = (file && fileHeaders.length > 0)
        ? [...fileHeaders.map(h => ({ header: h, accessor: h })), ...simpleColumns.filter(c => c.accessor !== 'orcid')]
        : simpleColumns;

      const uniqueColumns = allColumns.filter((v,i,a)=>a.findIndex(t=>(t.accessor === v.accessor))===i);

      const reviewListForFile: any[] = [];
      allReviewGroups.forEach((group, groupIndex) => {
          group.forEach(item => {
              reviewListForFile.push({
                  ...item,
                  [t('colReviewGroupId')]: groupIndex + 1,
              });
          });
      });

      // Initialize Dashboard
        const defaultWidgets: DashboardWidget[] = [
            { id: 'total_pubs', type: 'total_publications' },
            { id: 'unique_authors', type: 'unique_authors' },
            { id: 'pubs_by_year', type: 'publications_by_year' },
        ];
        const defaultLayouts = {
            lg: [
                { i: 'total_pubs', x: 0, y: 0, w: 3, h: 2 },
                { i: 'unique_authors', x: 3, y: 0, w: 3, h: 2 },
                { i: 'pubs_by_year', x: 0, y: 2, w: 6, h: 4 },
            ],
        };

      setState({
          results: allResults,
          manualReviewList: reviewListForFile,
          deduplicationLog: allDedupLogs,
          reviewGroups: allReviewGroups,
          reviewIndex: allReviewGroups.length > 0 ? 0 : -1,
          processStats: { orcidInitial: totalOrcidInitial, totalFinal: allResults.length, duplicatesRemoved: allDedupLogs.length },
          chartColumns: uniqueColumns,
          statsStartYear: startYear,
          statsEndYear: endYear,
          progress: null,
          statusText: t('progressComplete', { count: allResults.length }),
          dashboardWidgets: defaultWidgets,
          dashboardLayouts: defaultLayouts,
      });

      logEvent('fetch_data_success', { module: 'orcid', count: allResults.length });

    } catch (err: any) {
      setState({ error: `${t('errorFetchFailed')}: ${err.message}`, progress: null, statusText: t('progressFailed') });
      logEvent('fetch_data_error', { module: 'orcid', error: err.message });
    } finally {
      setState({ isLoading: false });
    }
  }, [orcidIds, startYear, endYear, file, t, originalData, sourceColumn, enabledServices, isFilterEnabled, filterColumn, selectedFilterValues, simpleColumns, deduplicationMethod, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold]);

  const columns = useMemo(() => {
    if (file && fileHeaders.length > 0) {
        const originalColumns = fileHeaders.map(h => ({ header: h, accessor: h }));
        const publicationColumns = simpleColumns.filter(c => c.accessor !== 'orcid');
        return [...originalColumns, ...publicationColumns];
    }
    return simpleColumns;
  },[file, fileHeaders, simpleColumns]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        handleReset();
        setState({ file: selectedFile, fileName: selectedFile.name });
        try {
            const { headers, data } = await parseExcel(selectedFile);
            if (headers.length > 0) {
                const orcidHeader = headers.find(h => h.toUpperCase() === 'ORCID');
                setState({
                    fileHeaders: headers,
                    originalData: data,
                    sourceColumn: orcidHeader || headers[0],
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
    setState({ orcidIds: e.target.value });
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

      if (yearFilteredResults.length === 0) {
          setState({ error: t('errorNoPublicationsForYears') });
          return null;
      }
      
      const pubTypes: string[] = [...new Set(yearFilteredResults.map<string>(p => String(p.type || 'N/A')))].sort();
      return { yearFilteredResults, pubTypes };
  };

  const handleGenerateAuthorStatsByYear = () => {
    const prep = getFilteredAndPreppedStats();
    if (!prep) return;
    const { yearFilteredResults, pubTypes } = prep;
      
    const statsData: Record<string, any>[] = [];

    if (file) {
        const pubsByOrcid = new Map<string, Record<string, any>[]>();
        yearFilteredResults.forEach(pub => {
            const orcid = pub.orcid?.toString().trim();
            if (!orcid) return;
            if (!pubsByOrcid.has(orcid)) {
                pubsByOrcid.set(orcid, []);
            }
            pubsByOrcid.get(orcid)!.push(pub);
        });

        originalData.forEach(authorRow => {
            const authorId = authorRow[sourceColumn]?.toString().trim();
            const authorPubs = pubsByOrcid.get(authorId) || [];
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
                    const type = String(pub.type || 'N/A');
                    if (stats.hasOwnProperty(type)) stats[type]++;
                });
                
                const totalCount = yearPubs.length;
                const rowWithStats: Record<string, any> = { ...authorRow, 'Year': year, 'Total Publications': totalCount };
                pubTypes.forEach(type => { rowWithStats[type] = stats[type]; });

                statsData.push(rowWithStats);
            });
        });
    } else {
        const authorIds = [...new Set(yearFilteredResults.map(p => p.orcid))];
        authorIds.forEach(authorId => {
            const authorPubs = yearFilteredResults.filter(p => p.orcid === authorId);
            
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
                    const type = String(pub.type || 'N/A');
                    if (stats.hasOwnProperty(type)) stats[type]++;
                });
                const totalCount = yearPubs.length;
                const rowWithStats: Record<string, any> = { 'ORCID iD': authorId, 'Year': year, 'Total Publications': totalCount };
                pubTypes.forEach(type => { rowWithStats[type] = stats[type]; });
                statsData.push(rowWithStats);
            });
        });
    }
    
    exportObjectsToXlsx(statsData, 'orcid_author_stats_by_year.xlsx');
  };

  const handleGenerateGroupedStatsSummary = () => {
    if (!groupingColumn) { setState({ error: t('errorNoGroupingColumn') }); return; }
    const prep = getFilteredAndPreppedStats();
    if (!prep) return;
    const { yearFilteredResults, pubTypes } = prep;

    const groupedPubs = new Map<string, Record<string, any>[]>();
    yearFilteredResults.forEach(pub => {
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
            const type = String(pub.type || 'N/A');
            if (stats.hasOwnProperty(type)) stats[type]++;
        });
        
        pubTypes.forEach(type => { row[type] = stats[type]; });
        row['Total Publications'] = pubs.length;
        statsData.push(row);
    });
    
    statsData.sort((a, b) => a[groupingColumn] > b[groupingColumn] ? 1 : -1);
    
    exportObjectsToXlsx(statsData, `orcid_grouped_stats_summary_by_${groupingColumn}.xlsx`);
  };

  const handleGenerateGroupedStatsByYear = () => {
    if (!groupingColumn) { setState({ error: t('errorNoGroupingColumn') }); return; }
    const prep = getFilteredAndPreppedStats();
    if (!prep) return;
    const { yearFilteredResults, pubTypes } = prep;

    const groupedPubs = new Map<string, Record<string, any>[]>();

    yearFilteredResults.forEach(pub => {
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
                const type = String(pub.type || 'N/A');
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
    
    exportObjectsToXlsx(statsData, `orcid_grouped_stats_by_year_by_${groupingColumn}.xlsx`);
  };

  const handleGenerateCompletenessReport = () => {
      const prep = getFilteredAndPreppedStats();
      if (!prep) return;
      const { yearFilteredResults } = prep;

      const allSources = [...new Set(yearFilteredResults.map(p => p.sours || 'N/A'))].sort();

      const pubsByOrcid = new Map<string, Record<string, any>[]>();
      yearFilteredResults.forEach(pub => {
          const orcid = pub.orcid?.toString().trim();
          if (!orcid) return;
          if (!pubsByOrcid.has(orcid)) {
              pubsByOrcid.set(orcid, []);
          }
          pubsByOrcid.get(orcid)!.push(pub);
      });

      const statsData: Record<string, any>[] = [];
      originalData.forEach(authorRow => {
          const orcid = authorRow[sourceColumn]?.toString().trim();
          const authorPubs = pubsByOrcid.get(orcid) || [];
          const totalPubs = authorPubs.length;

          if (totalPubs === 0) return; 

          const pubsWithDoi = authorPubs.filter(p => p.doi).length;
          const percentageWithDoi = ((pubsWithDoi / totalPubs) * 100).toFixed(1) + '%';

          const sourceCounts: Record<string, number> = {};
          allSources.forEach(source => sourceCounts[source] = 0);
          authorPubs.forEach(pub => {
              const source = pub.sours || 'N/A';
              sourceCounts[source]++;
          });

          const pubsByAuthor = sourceCounts['author'] || 0;
          const percentageByAuthor = ((pubsByAuthor / totalPubs) * 100).toFixed(1) + '%';
          
          const sourceCountHeaders: Record<string, number> = {};
          for (const source of allSources) {
              sourceCountHeaders[source] = sourceCounts[source];
          }

          const rowData: Record<string, any> = {
              ...authorRow,
              [t('colTotalPublications')]: totalPubs,
              [t('colPublicationsWithDoi')]: pubsWithDoi,
              [t('colPercentageWithDoi')]: percentageWithDoi,
              ...sourceCountHeaders,
              [t('colSelfSubmitted')]: pubsByAuthor,
              [t('colPercentageSelfSubmitted')]: percentageByAuthor,
          };
          statsData.push(rowData);
      });
      
      if (statsData.length === 0) {
          setState({ error: t('errorNoPublicationsForYears') });
          return;
      }

      exportObjectsToXlsx(statsData, 'orcid_author_completeness_report.xlsx');
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
  
  const handleDownloadManualReview = () => {
      if (manualReviewList.length === 0) return;
      exportObjectsToXlsx(manualReviewList, `manual_review_orcid_${fileName || 'export'}.xlsx`);
  };

  const handleDownloadDedupLog = () => {
      if (deduplicationLog.length === 0) return;
      exportObjectsToXlsx(deduplicationLog, `deduplication_log_orcid_${fileName || 'export'}.xlsx`);
  };

  const handleMatchThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue <= jaroWinklerReviewThreshold) {
      setState({ jaroWinklerMatchThreshold: newValue, jaroWinklerReviewThreshold: Math.max(80, newValue - 1) });
    } else {
      setState({ jaroWinklerMatchThreshold: newValue });
    }
  };

  const handleReviewThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue >= jaroWinklerMatchThreshold) {
      setState({ jaroWinklerReviewThreshold: newValue, jaroWinklerMatchThreshold: Math.min(100, newValue + 1) });
    } else {
      setState({ jaroWinklerReviewThreshold: newValue });
    }
  };

  const handleReviewDecision = (recordsToKeep: any[]) => {
    if (reviewIndex < 0) return;
    const currentGroup = reviewGroups[reviewIndex];
    if (!currentGroup) return;

    const idsToKeep = new Set(recordsToKeep.map(r => r._id));
    const idsToRemove = new Set(currentGroup.filter(r => !idsToKeep.has(r._id)).map(r => r._id));
    
    let newResults = results;
    if (idsToRemove.size > 0) {
        newResults = results.filter(r => !idsToRemove.has(r._id));
    }

    const nextIndex = reviewIndex + 1;
    if (nextIndex >= reviewGroups.length) {
        // Last one, finish review
        setState({ results: newResults, reviewIndex: -1, reviewGroups: [] });
    } else {
        setState({ results: newResults, reviewIndex: nextIndex });
    }
  };


  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startYearOrcid" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
              <input id="startYearOrcid" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder')} />
            </div>
            <div>
              <label htmlFor="endYearOrcid" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
              <input id="endYearOrcid" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder2')} />
            </div>
        </div>
        <div/>
        <div>
            <label htmlFor="orcidIds" className="block text-sm font-medium text-secondary-600 mb-2">{t('orcidIdsLabel')}</label>
            <textarea id="orcidIds" value={orcidIds} onChange={handleTextareaChange} rows={4} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder="0000-0002-1825-0097&#10;0000-0001-5109-3700" disabled={!!file} />
        </div>
        <div>
            <label htmlFor="excelFileOrcid" className="block text-sm font-medium text-secondary-600 mb-2">{t('uploadExcelLabel')}</label>
            <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-secondary-300 border-dashed rounded-lg h-full bg-secondary-50 hover:bg-secondary-100 hover:border-primary-400 transition-colors duration-200 group">
                <div className="space-y-1 text-center">
                     <div className="w-12 h-12 mx-auto text-secondary-400 group-hover:text-primary-600 transition-colors">
                        <UploadIcon />
                     </div>
                    <div className="flex text-sm text-secondary-600 justify-center">
                        <label htmlFor="excelFileOrcid" className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-800 focus-within:outline-none">
                            <span>{t('uploadFileLink')}</span>
                            <input id="excelFileOrcid" name="excelFileOrcid" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} ref={fileInputRef} />
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
                    <label htmlFor="sourceColumnOrcid" className="block text-sm font-medium text-secondary-600 mb-2">
                    {t('selectIdColumnLabelOrcid')}
                    </label>
                    <select
                    id="sourceColumnOrcid"
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
                            id="enable-filter-orcid"
                            type="checkbox"
                            checked={isFilterEnabled}
                            onChange={(e) => setState({ isFilterEnabled: e.target.checked })}
                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="enable-filter-orcid" className="ml-2 block text-sm font-semibold text-secondary-800">
                            {t('enableFilterLabel')}
                        </label>
                    </div>

                    {isFilterEnabled && (
                        <div className="mt-4 space-y-4 animate-slide-in-up">
                            <div>
                                <label htmlFor="filter-column-orcid" className="block text-sm font-medium text-secondary-600 mb-2">
                                    {t('selectFilterColumnLabel')}
                                </label>
                                <select
                                    id="filter-column-orcid"
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
                                                    id={`orcid-filter-val-${value}`}
                                                    type="checkbox"
                                                    checked={selectedFilterValues.includes(value)}
                                                    onChange={() => handleFilterValueChange(value)}
                                                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <label htmlFor={`orcid-filter-val-${value}`} className="ml-2 block text-sm text-secondary-700 truncate cursor-pointer flex-1">{value}</label>
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
         <div className="md:col-span-2 animate-slide-in-up">
            <fieldset className="border border-secondary-300 rounded-lg p-4">
                <legend className="text-sm font-medium text-secondary-600 px-2">{t('unifiedDeduplicationMethodTitle')}</legend>
                <div className="mt-2 space-y-4">
                    <div className="flex items-start">
                        <input id="dedup-standard-orcid" name="deduplication-method-orcid" type="radio" checked={deduplicationMethod === 'standard'} onChange={() => setState({ deduplicationMethod: 'standard' })} className="h-4 w-4 mt-1 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                        <label htmlFor="dedup-standard-orcid" className="ml-3 block text-sm">
                            <span className="font-semibold text-secondary-800">{t('unifiedDeduplicationStandard')}</span>
                            <p className="text-secondary-600">{t('unifiedDeduplicationStandardDesc')}</p>
                        </label>
                    </div>
                     <div className="flex items-start">
                        <input id="dedup-advanced-orcid" name="deduplication-method-orcid" type="radio" checked={deduplicationMethod === 'advanced'} onChange={() => setState({ deduplicationMethod: 'advanced' })} className="h-4 w-4 mt-1 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                        <label htmlFor="dedup-advanced-orcid" className="ml-3 block text-sm">
                            <span className="font-semibold text-secondary-800">{t('unifiedDeduplicationAdvanced')}</span>
                            <p className="text-secondary-600">{t('unifiedDeduplicationAdvancedDesc')}</p>
                        </label>
                    </div>
                     {deduplicationMethod === 'advanced' && (
                        <div className="pl-7 pt-2 space-y-4 animate-slide-in-up">
                            <div>
                                <label htmlFor="match-threshold-orcid" className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedMatchThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerMatchThreshold}%</span></label>
                                <input type="range" id="match-threshold-orcid" min="90" max="100" value={jaroWinklerMatchThreshold} onChange={handleMatchThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                                <p className="text-xs text-secondary-500 mt-1">{t('unifiedMatchThresholdDesc')}</p>
                            </div>
                             <div>
                                <label htmlFor="review-threshold-orcid" className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedReviewThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerReviewThreshold}%</span></label>
                                <input type="range" id="review-threshold-orcid" min="80" max="96" value={jaroWinklerReviewThreshold} onChange={handleReviewThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                                <p className="text-xs text-secondary-500 mt-1">{t('unifiedReviewThresholdDesc')}</p>
                            </div>
                        </div>
                     )}
                </div>
            </fieldset>
        </div>
         <div className="md:col-span-2 animate-slide-in-up">
            <fieldset className="border border-secondary-300 rounded-lg p-4">
                <legend className="text-sm font-medium text-secondary-600 px-2">{t('orcidMetadataSourcesTitle')}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <div className="flex items-center">
                    <input
                    id="crossref-toggle"
                    type="checkbox"
                    checked={enabledServices.crossref}
                    onChange={() => handleServiceToggle('crossref')}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="crossref-toggle" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceCrossRef')}</label>
                </div>
                <div className="flex items-center">
                    <input
                    id="datacite-toggle"
                    type="checkbox"
                    checked={enabledServices.datacite}
                    onChange={() => handleServiceToggle('datacite')}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="datacite-toggle" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceDataCite')}</label>
                </div>
                <div className="flex items-center">
                    <input
                    id="zenodo-toggle"
                    type="checkbox"
                    checked={enabledServices.zenodo}
                    onChange={() => handleServiceToggle('zenodo')}
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="zenodo-toggle" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceZenodo')}</label>
                </div>
                </div>
            </fieldset>
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

      {!isLoading && processStats && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg shadow-sm animate-slide-in-up">
            <h4 className="font-bold text-blue-800">{t('unifiedProcessSummaryTitle')}</h4>
            <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
                <li>{t('unifiedOrcidInitial')}: <span className="font-semibold">{processStats.orcidInitial}</span></li>
                <li>{t('unifiedDuplicatesRemoved')}: <span className="font-semibold">{processStats.duplicatesRemoved}</span></li>
                <li className="font-bold pt-1">{t('unifiedTotalFinal')}: <span className="font-semibold">{processStats.totalFinal}</span></li>
            </ul>
        </div>
      )}

      {!isLoading && (manualReviewList.length > 0 || deduplicationLog.length > 0) && (
          <div className="mb-6">
              <CollapsibleSection title={t('manualReviewSheetTitle')} defaultOpen={true}>
                  <div className="space-y-4">
                      {reviewGroups.length > 0 && reviewIndex >= 0 ? (
                          <InteractiveReview
                              group={reviewGroups[reviewIndex]}
                              currentIndex={reviewIndex}
                              total={reviewGroups.length}
                              onDecision={handleReviewDecision}
                          />
                      ): null}

                      {manualReviewList.length > 0 && (
                          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                              <h4 className="font-bold text-yellow-800">{t('manualReviewSheetTitle')} (File)</h4>
                              <p className="text-sm text-yellow-700 mt-1 mb-3">{t('unifiedManualReviewAvailable')}</p>
                              <button onClick={handleDownloadManualReview} className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow">
                                  <DownloadIcon />
                                  {t('unifiedDownloadManualReview')}
                              </button>
                          </div>
                      )}
                      {deduplicationLog.length > 0 && (
                          <div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                              <h4 className="font-bold text-gray-800">{t('unifiedDeduplicationLogTitle')}</h4>
                              <p className="text-sm text-gray-700 mt-1 mb-3">{t('unifiedDeduplicationLogDesc', { count: deduplicationLog.length })}</p>
                              <button onClick={handleDownloadDedupLog} className="inline-flex items-center gap-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow">
                                  <DownloadIcon />
                                  {t('unifiedDownloadDedupLog')}
                              </button>
                          </div>
                      )}
                  </div>
              </CollapsibleSection>
          </div>
      )}
      
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
                          <h4 className="font-semibold text-secondary-700 mb-2">{t('authorStatsTitleOrcidByYear')}</h4>
                          <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('authorStatsDescriptionOrcidByYear')}</p>
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
                                <h4 className="font-semibold text-secondary-700 mb-2">{t('orcidAuthorStatsCompletenessTitle')}</h4>
                                <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('orcidAuthorStatsCompletenessDesc')}</p>
                                <button 
                                  onClick={handleGenerateCompletenessReport} 
                                  className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:from-secondary-400 disabled:to-secondary-500 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                                >
                                  {t('generateAndDownloadButton')}
                                </button>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                              <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleOrcidSummary')}</h4>
                              <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionOrcidSummary')}</p>
                              <div className="mb-4">
                                  <label htmlFor="grouping-column-orcid-total" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                                  <select 
                                  id="grouping-column-orcid-total" 
                                  value={groupingColumn} 
                                  onChange={(e) => setState({ groupingColumn: e.target.value })} 
                                  className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm"
                                  >
                                  {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                              </div>
                              <button 
                                  onClick={handleGenerateGroupedStatsSummary} 
                                  disabled={!groupingColumn} 
                                  className="w-full mt-auto bg-gradient-to-r from-secondary-700 to-secondary-800 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:from-secondary-400 disabled:to-secondary-500 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                              >
                                  {t('generateAndDownloadButton')}
                              </button>
                              </div>

                              <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm flex flex-col">
                              <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleOrcidByYear')}</h4>
                              <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionOrcidByYear')}</p>
                              <div className="mb-4">
                                  <label htmlFor="grouping-column-orcid-by-year" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                                  <select 
                                  id="grouping-column-orcid-by-year" 
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
                         {/* Fix: Pass yCalculation and yValueColumn to config */}
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
      
      {results.length > 0 && <DataTable columns={columns as any} data={results} filename="orcid_publications.xlsx" fixedHeight />}
    </div>
  );
};

export default OrcidTab;