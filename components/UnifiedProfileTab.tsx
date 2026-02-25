import React, { useRef, useState } from 'react';
import type { YearRange, EnabledMetadataServices } from '../types';
import DataTable from './DataTable';
import Loader from './Loader';
import { UploadIcon } from './icons/UploadIcon';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialUnifiedProfileState } from '../contexts/TabsStateContext';
import { fetchAuthorMetrics, fetchAuthorPublications } from '../services/scopusService';
import { fetchAndProcessOrcidWorks } from '../services/orcidService';
import ProgressBar from './ProgressBar';
import { jaroWinkler, normalizeTitleForComparison } from '../utils/jaroWinkler';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { DownloadIcon } from './icons/DownloadIcon';
import ChartConstructor from './ChartConstructor';
import InteractiveReview from './InteractiveReview';
import CollapsibleSection from './CollapsibleSection';

declare const XLSX: any;

const normalizeDoi = (doi: string | null | undefined): string | null => {
    if (!doi) return null;
    return doi.toLowerCase().replace("https://doi.org/", "").trim();
};


const UnifiedProfileTab: React.FC = () => {
  const { unifiedProfileState, setUnifiedProfileState } = useTabsState();
  const {
    apiKey, startYear, endYear, file, fileName, results, isLoading, error, statusText, progress,
    fileHeaders, scopusColumn, orcidColumn, originalData, enabledServices, deduplicationMethod, manualReviewList,
    jaroWinklerMatchThreshold, jaroWinklerReviewThreshold, processStats, deduplicationLog,
    reviewIndex, reviewGroups,
    // Fix: Replace chartConfigY with chartConfigYCalculation and chartConfigYValueColumn
    groupingColumn, statsStartYear, statsEndYear, chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType,
    chartConfigFilterX, chartConfigFilterGroup,
    // Fix: Add chartConfigLabelDisplay to destructuring
    chartConfigLabelDisplay
  } = unifiedProfileState;

  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useState<'reports' | 'chart'>('reports');
  
  const setState = (updates: Partial<typeof unifiedProfileState>) => {
    setUnifiedProfileState(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setUnifiedProfileState({ ...initialUnifiedProfileState, apiKey: unifiedProfileState.apiKey });
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

   const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        handleReset();
        setState({ file: selectedFile, fileName: selectedFile.name });
        try {
            const { headers, data } = await parseExcel(selectedFile);
            if (headers.length > 0) {
                const scopusHeader = headers.find(h => h.toUpperCase().includes('SCOPUS'));
                const orcidHeader = headers.find(h => h.toUpperCase().includes('ORCID'));
                setState({
                    fileHeaders: headers,
                    originalData: data,
                    scopusColumn: scopusHeader || headers[0],
                    orcidColumn: orcidHeader || headers[0],
                });
            } else {
                setState({ error: t('apaErrorEmptyFile'), file: null, fileName: '' });
            }
        } catch (err: any) {
            setState({ error: err.message, file: null, fileName: '' });
        }
    }
  };

  const handleFetch = useCallback(async () => {
    if (!file || !scopusColumn || !orcidColumn) {
      setState({ error: t('unifiedProfileErrorConfig') });
      return;
    }
     if (!apiKey) {
      setState({ error: t('errorApiKeyRequired') });
      return;
    }

    const yearRange: YearRange = {
      start: startYear ? parseInt(startYear) : undefined,
      end: endYear ? parseInt(endYear) : undefined,
    };

    setState({ isLoading: true, error: null, results: [], statusText: '', progress: null, manualReviewList: [], processStats: null, deduplicationLog: [], reviewIndex: -1, reviewGroups: [] });
    logEvent('fetch_data_start', { module: 'unified_profile' });

    try {
        const allResults: any[] = [];
        const allReviewGroups: any[][] = [];
        const allForReviewExcel: any[] = [];
        const allDedupLogs: any[] = [];
        const totalRows = originalData.length;
        
        let totalScopusInitial = 0;
        let totalOrcidInitial = 0;

        const getPriority = (pub: any) => {
            if (pub.source === 'Scopus') return 1;
            if (pub.orcid_source === "Web of Science Researcher Profile Sync") return 2;
            if (pub.orcid_source === "Scopus - Elsevier") return 3;
            if (pub.orcid_source === "author") return 10;
            return 5; // Other ORCID sources have medium priority
        };

        for (let i = 0; i < totalRows; i++) {
            const rowData = originalData[i];
            const scopusId = rowData[scopusColumn]?.toString().trim();
            const orcidId = rowData[orcidColumn]?.toString().trim();
            const authorName = rowData['Автор'] || `Row ${i + 1}`;
            
            setState({ 
                progress: { current: i + 1, total: totalRows },
                statusText: t('progressProcessingAuthor', { current: i + 1, total: totalRows, author: authorName })
            });
            
            if (!scopusId && !orcidId) continue;

            let scopusPubs: ScopusPublication[] = [];
            let orcidWorks: OrcidWork[] = [];
            
            const promises = [];
            if(scopusId) {
                promises.push(
                    (async () => {
                        try {
                            const { hIndex } = await fetchAuthorMetrics(scopusId, apiKey);
                            const publications = await fetchAuthorPublications(scopusId, apiKey, yearRange);
                            scopusPubs = publications.map(pub => ({...pub, author_scopus: scopusId, h_index: hIndex }));
                        } catch (e) { console.error(`Error fetching Scopus for ${scopusId}:`, e); }
                    })()
                );
            }
            if(orcidId) {
                promises.push(
                    (async () => {
                         try {
                            const works = await fetchAndProcessOrcidWorks(orcidId, yearRange, enabledServices);
                            orcidWorks = works;
                         } catch (e) { console.error(`Error fetching ORCID for ${orcidId}:`, e); }
                    })()
                );
            }
            
            await Promise.allSettled(promises);
            
            totalScopusInitial += scopusPubs.length;
            totalOrcidInitial += orcidWorks.length;

            let finalPubsForAuthor: any[] = [];
            const dedupLogForAuthor: any[] = [];

            const scopusMapped = scopusPubs.map(p => ({ ...p, _id: `s_${p.eid || Math.random().toString(36).substring(2)}`, source: 'Scopus', pub_type: p.pub_type }));
            const orcidMapped = orcidWorks.map(w => ({ ...w, _id: `o_${w.put_code || Math.random().toString(36).substring(2)}`, source: 'ORCID', pub_type: w.type, orcid_source: w.sours }));
            
            const allPubsForAuthor = [...scopusMapped, ...orcidMapped];

            if (allPubsForAuthor.length > 0) {
                    const duplicatesToRemove = new Set<string>();
                    const potentialReviewItems: {item1: any, item2: any, score: number}[] = [];

                    for (let i = 0; i < allPubsForAuthor.length; i++) {
                        if (duplicatesToRemove.has(allPubsForAuthor[i]._id)) continue;
                        for (let j = i + 1; j < allPubsForAuthor.length; j++) {
                            if (duplicatesToRemove.has(allPubsForAuthor[j]._id)) continue;

                            const pub1 = allPubsForAuthor[i];
                            const pub2 = allPubsForAuthor[j];
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
                                const titleMatch = title1Norm && title2Norm && title1Norm.length > 0 && title1Norm === title2Norm;
                                if (titleMatch) {
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
                                if (pub1.source === 'Scopus' && pub2.source === 'Scopus') {
                                    // Both are Scopus, do not remove.
                                } else {
                                    const [keep, remove] = getPriority(pub1) <= getPriority(pub2) ? [pub1, pub2] : [pub2, pub1];
                                    if (!duplicatesToRemove.has(remove._id)) {
                                        duplicatesToRemove.add(remove._id);
                                        const { _id: _removedId, ...logData } = remove;
                                        dedupLogForAuthor.push({
                                            ...logData,
                                            [t('colReasonForRemoval')]: `Duplicate by title/year/DOI match.`,
                                            [t('colDuplicateOfTitle')]: keep.title,
                                            [t('colDuplicateOfDOI')]: keep.doi,
                                        });
                                    }
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

                finalPubsForAuthor = allPubsForAuthor.filter(p => !duplicatesToRemove.has(p._id));
            }
            
            if (dedupLogForAuthor.length > 0) {
                allDedupLogs.push(...dedupLogForAuthor.map(logEntry => ({ ...rowData, ...logEntry })));
            }

            if (finalPubsForAuthor.length > 0) {
                 allResults.push(...finalPubsForAuthor.map(pub => ({ ...rowData, ...pub })));
            } else if (scopusPubs.length === 0 && orcidWorks.length === 0) {
                 allResults.push({ ...rowData, title: t('infoNoPublications') });
            }
        }
        
        let reviewGroupCounter = 0;
        allReviewGroups.forEach(group => {
            reviewGroupCounter++;
            group.forEach(item => {
                allForReviewExcel.push({
                    ...item,
                    [t('colReviewGroupId')]: reviewGroupCounter,
                });
            });
        });

        

        setState({
            results: allResults,
            manualReviewList: allForReviewExcel,
            deduplicationLog: allDedupLogs,
            reviewGroups: allReviewGroups,
            reviewIndex: allReviewGroups.length > 0 ? 0 : -1,
            progress: null,
            statusText: t('progressComplete', { count: allResults.length }),
            processStats: {
                scopusInitial: totalScopusInitial,
                orcidInitial: totalOrcidInitial,
                totalFinal: allResults.length,
                duplicatesRemoved: allDedupLogs.length,
            },
            chartColumns: uniqueColumns.map(c => ({ accessor: c.accessor as string, header: c.header })),
            groupingColumn: fileHeaders.length > 0 ? fileHeaders[0] : '',
            statsStartYear: startYear,
            statsEndYear: endYear,
        });
        logEvent('fetch_data_success', { module: 'unified_profile', count: allResults.length });

    } catch (err: any) {
      setState({ error: `${t('errorFetchFailed')}: ${err.message}`, progress: null, statusText: t('progressFailed') });
      logEvent('fetch_data_error', { module: 'unified_profile', error: err.message });
    } finally {
      setState({ isLoading: false });
    }
  }, [apiKey, startYear, endYear, file, t, originalData, scopusColumn, orcidColumn, enabledServices, deduplicationMethod, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold]);

  const handleDownloadManualReview = () => {
      if (manualReviewList.length === 0) return;
      exportObjectsToXlsx(manualReviewList, `manual_review_${fileName}`);
  };

  const handleDownloadDedupLog = () => {
      if (deduplicationLog.length === 0) return;
      exportObjectsToXlsx(deduplicationLog, `deduplication_log_${fileName}`);
  };

  const handleMatchThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue <= jaroWinklerReviewThreshold) {
      setState({
        jaroWinklerMatchThreshold: newValue,
        jaroWinklerReviewThreshold: Math.max(80, newValue - 1),
      });
    } else {
      setState({ jaroWinklerMatchThreshold: newValue });
    }
  };

  const handleReviewThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue >= jaroWinklerMatchThreshold) {
      setState({
        jaroWinklerReviewThreshold: newValue,
        jaroWinklerMatchThreshold: Math.min(100, newValue + 1),
      });
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
        setState({ results: newResults, reviewIndex: -1, reviewGroups: [] });
    } else {
        setState({ results: newResults, reviewIndex: nextIndex });
    }
  };

  const columns = [
    ...fileHeaders.map(h => ({ header: h, accessor: h })),
    { header: t('colSource'), accessor: 'source' },
    { header: t('colOrcidSource'), accessor: 'orcid_source' },
    { header: t('colHIndex'), accessor: 'h_index' },
    { header: t('colTitle'), accessor: 'title' },
    { header: t('colJournal'), accessor: 'journal' },
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
  ];

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
      
      const pubTypes: string[] = [...new Set(yearFilteredResults.map<string>(p => String(p.pub_type || 'N/A')))].sort();
      return { yearFilteredResults, pubTypes };
  };

    const getFilteredAndPreppedStatsForAuthorReport = () => {
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
  };

  const handleGenerateAuthorStatsByYear = () => {
      const prep = getFilteredAndPreppedStatsForAuthorReport();
      if (!prep) return;
      const { knuAffiliatedResults, pubTypes } = prep;
      
      const statsData: Record<string, any>[] = [];

      const authorIdentifierKey = scopusColumn || orcidColumn;
      if (!authorIdentifierKey) {
          setState({ error: "Cannot identify authors without a Scopus or ORCID column." });
          return;
      }

      const pubsByAuthorId = new Map<string, Record<string, any>[]>();
      knuAffiliatedResults.forEach(pub => {
          const authorId = pub[authorIdentifierKey]?.toString().trim();
          if (!authorId) return;
          if (!pubsByAuthorId.has(authorId)) {
              pubsByAuthorId.set(authorId, []);
          }
          pubsByAuthorId.get(authorId)!.push(pub);
      });

      originalData.forEach(authorRow => {
          const authorId = authorRow[authorIdentifierKey]?.toString().trim();
          if (!authorId) return;
          
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
      
      exportObjectsToXlsx(statsData, 'unified_author_stats_by_year_knu.xlsx');
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
            const type = String(pub.pub_type || 'N/A');
            if (stats.hasOwnProperty(type)) stats[type]++;
        });
        
        pubTypes.forEach(type => { row[type] = stats[type]; });
        row['Total Publications'] = pubs.length;
        statsData.push(row);
    });
    
    statsData.sort((a, b) => a[groupingColumn] > b[groupingColumn] ? 1 : -1);
    
    exportObjectsToXlsx(statsData, `unified_grouped_stats_summary_by_${groupingColumn}.xlsx`);
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
    
    exportObjectsToXlsx(statsData, `unified_grouped_stats_by_year_by_${groupingColumn}.xlsx`);
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
  }

   const handleChartFilterChange = (key: 'x' | 'group', value: string[] | null) => {
    const newFilters = { [`chartConfigFilter${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
    setState(newFilters as any);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="apiKeyUnified" className="block text-sm font-medium text-secondary-600 mb-2">{t('apiKeyLabel')}</label>
          <input id="apiKeyUnified" type="password" value={apiKey} onChange={(e) => setState({ apiKey: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('apiKeyPlaceholder')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startYearUnified" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
              <input id="startYearUnified" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder')} />
            </div>
            <div>
              <label htmlFor="endYearUnified" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
              <input id="endYearUnified" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all duration-200 shadow-sm hover:shadow-md" placeholder={t('yearPlaceholder2')} />
            </div>
        </div>
        <div className="md:col-span-2">
            <label htmlFor="excelFileUnified" className="block text-sm font-medium text-secondary-600 mb-2">{t('uploadAuthorFileLabel')}</label>
            <div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-secondary-300 border-dashed rounded-lg h-full bg-secondary-50 hover:bg-secondary-100 hover:border-primary-400 transition-colors duration-200 group">
                <div className="space-y-1 text-center">
                     <div className="w-12 h-12 mx-auto text-secondary-400 group-hover:text-primary-600 transition-colors">
                        <UploadIcon />
                     </div>
                    <div className="flex text-sm text-secondary-600 justify-center">
                        <label htmlFor="excelFileUnified" className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-800 focus-within:outline-none">
                            <span>{t('uploadFileLink')}</span>
                            <input id="excelFileUnified" name="excelFileUnified" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} ref={fileInputRef} />
                        </label>
                        <p className="pl-1">{t('dragAndDrop')}</p>
                    </div>
                    {fileName && <p className="text-sm text-green-600 mt-2">{t('selectedFile')}: {fileName}</p>}
                </div>
            </div>
        </div>
        {file && fileHeaders.length > 0 && (
          <div className="md:col-span-2 space-y-4 animate-slide-in-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="scopusColumn" className="block text-sm font-medium text-secondary-600 mb-2">
                    {t('selectIdColumnLabelUnifiedScopus')}
                    </label>
                    <select
                        id="scopusColumn"
                        value={scopusColumn}
                        onChange={(e) => setState({ scopusColumn: e.target.value })}
                        className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                        {fileHeaders.map(header => (<option key={`scopus-${header}`} value={header}>{header}</option>))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="orcidColumn" className="block text-sm font-medium text-secondary-600 mb-2">
                    {t('selectIdColumnLabelUnifiedOrcid')}
                    </label>
                    <select
                        id="orcidColumn"
                        value={orcidColumn}
                        onChange={(e) => setState({ orcidColumn: e.target.value })}
                        className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                        {fileHeaders.map(header => (<option key={`orcid-${header}`} value={header}>{header}</option>))}
                    </select>
                </div>
            </div>
            <fieldset className="border border-secondary-300 rounded-lg p-4">
                <legend className="text-sm font-medium text-secondary-600 px-2">{t('unifiedDeduplicationMethodTitle')}</legend>
                <div className="mt-2 space-y-4">
                    <div className="flex items-start">
                        <input id="dedup-standard" name="deduplication-method" type="radio" checked={deduplicationMethod === 'standard'} onChange={() => setState({ deduplicationMethod: 'standard' })} className="h-4 w-4 mt-1 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                        <label htmlFor="dedup-standard" className="ml-3 block text-sm">
                            <span className="font-semibold text-secondary-800">{t('unifiedDeduplicationStandard')}</span>
                            <p className="text-secondary-600">{t('unifiedDeduplicationStandardDesc')}</p>
                        </label>
                    </div>
                     <div className="flex items-start">
                        <input id="dedup-advanced" name="deduplication-method" type="radio" checked={deduplicationMethod === 'advanced'} onChange={() => setState({ deduplicationMethod: 'advanced' })} className="h-4 w-4 mt-1 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                        <label htmlFor="dedup-advanced" className="ml-3 block text-sm">
                            <span className="font-semibold text-secondary-800">{t('unifiedDeduplicationAdvanced')}</span>
                            <p className="text-secondary-600">{t('unifiedDeduplicationAdvancedDesc')}</p>
                        </label>
                    </div>
                     {deduplicationMethod === 'advanced' && (
                        <div className="pl-7 pt-2 space-y-4 animate-slide-in-up">
                            <div>
                                <label htmlFor="match-threshold" className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedMatchThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerMatchThreshold}%</span></label>
                                <input type="range" id="match-threshold" min="90" max="100" value={jaroWinklerMatchThreshold} onChange={handleMatchThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                                <p className="text-xs text-secondary-500 mt-1">{t('unifiedMatchThresholdDesc')}</p>
                            </div>
                             <div>
                                <label htmlFor="review-threshold" className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedReviewThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerReviewThreshold}%</span></label>
                                <input type="range" id="review-threshold" min="80" max="96" value={jaroWinklerReviewThreshold} onChange={handleReviewThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                                <p className="text-xs text-secondary-500 mt-1">{t('unifiedReviewThresholdDesc')}</p>
                            </div>
                        </div>
                     )}
                </div>
            </fieldset>
             <fieldset className="border border-secondary-300 rounded-lg p-4">
                <legend className="text-sm font-medium text-secondary-600 px-2">{t('orcidMetadataSourcesTitle')}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <div className="flex items-center">
                    <input id="crossref-toggle-unified" type="checkbox" checked={enabledServices.crossref} onChange={() => handleServiceToggle('crossref')} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                    <label htmlFor="crossref-toggle-unified" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceCrossRef')}</label>
                </div>
                <div className="flex items-center">
                    <input id="datacite-toggle-unified" type="checkbox" checked={enabledServices.datacite} onChange={() => handleServiceToggle('datacite')} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                    <label htmlFor="datacite-toggle-unified" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceDataCite')}</label>
                </div>
                <div className="flex items-center">
                    <input id="zenodo-toggle-unified" type="checkbox" checked={enabledServices.zenodo} onChange={() => handleServiceToggle('zenodo')} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                    <label htmlFor="zenodo-toggle-unified" className="ml-2 block text-sm text-secondary-800">{t('orcidMetadataSourceZenodo')}</label>
                </div>
                </div>
            </fieldset>
          </div>
        )}
      </div>
       <div className="flex justify-end items-center gap-4 mb-6">
            <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-secondary-300 flex items-center gap-2 h-12 shadow-md" aria-label={t('resetButton')}>
                <RefreshIcon />
                <span>{t('resetButton')}</span>
            </button>
            <button onClick={handleFetch} disabled={isLoading || !file || !scopusColumn || !orcidColumn} className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg">
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
                <li>{t('unifiedScopusInitial')}: <span className="font-semibold">{processStats.scopusInitial}</span></li>
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
                          <h4 className="font-semibold text-secondary-700 mb-2">{t('authorStatsTitleUnifiedByYear')}</h4>
                          <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('authorStatsDescriptionUnifiedByYear')}</p>
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
                              <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleUnifiedSummary')}</h4>
                              <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionUnifiedSummary')}</p>
                              <div className="mb-4">
                                  <label htmlFor="grouping-column-unified-total" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                                  <select 
                                  id="grouping-column-unified-total" 
                                  value={groupingColumn} 
                                  onChange={(e) => setState({ groupingColumn: e.target.value })} 
                                  className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
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
                              <h4 className="font-semibold text-secondary-700 mb-2">{t('groupedStatsTitleUnifiedByYear')}</h4>
                              <p className="text-sm text-secondary-600 mb-4 flex-grow">{t('groupedStatsDescriptionUnifiedByYear')}</p>
                              <div className="mb-4">
                                  <label htmlFor="grouping-column-unified-by-year" className="block text-sm font-medium text-secondary-600 mb-1">{t('selectGroupingColumnLabel')}</label>
                                  <select 
                                  id="grouping-column-unified-by-year" 
                                  value={groupingColumn} 
                                  onChange={(e) => setState({ groupingColumn: e.target.value })} 
                                  className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
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
            </CollapsibleSection>
        </div>
      )}
      
      {results.length > 0 && <DataTable columns={columns as any} data={results} filename="unified_profile.xlsx" fixedHeight />}
    </div>
  );
};

export default UnifiedProfileTab;
