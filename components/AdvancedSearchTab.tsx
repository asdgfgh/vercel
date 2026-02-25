
import React, { useCallback, useRef, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState, initialAdvancedSearchState, DashboardWidget } from '../contexts/TabsStateContext';
import type { YearRange, EnabledMetadataServices, OrcidWork, StatisticsResult } from '../types';
import { fetchAuthorMetrics, fetchAuthorPublications, getCitationsByYearRange } from '../services/scopusService';
import { fetchAndProcessOrcidWorks } from '../services/orcidService';
import { logEvent } from '../services/analyticsService';
import { exportObjectsToXlsx, exportMultipleTablesToSingleXlsx } from '../utils/exportUtils';
import { jaroWinkler, normalizeTitleForComparison } from '../utils/jaroWinkler';
import { RefreshIcon } from './icons/RefreshIcon';
import { UploadIcon } from './icons/UploadIcon';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import ProgressBar from './ProgressBar';
import DataTable from './DataTable';
import { DownloadIcon } from './icons/DownloadIcon';
import CollapsibleSection from './CollapsibleSection';
import InteractiveReview from './InteractiveReview';

import ChartConstructor from './ChartConstructor';
import Dashboard from './Dashboard';

declare const XLSX: any;

const normalizeDoi = (doi: string | null | undefined): string | null => {
    if (!doi) return null;
    return doi.toLowerCase().replace("https://doi.org/", "").trim();
};

const AdvancedSearchTab: React.FC = () => {
    const { advancedSearchState, setAdvancedSearchState } = useTabsState();
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [resultView, setResultView] = useState<'table' | 'chart' | 'dashboard'>('table');

    const {
        apiKey, startYear, endYear, inputType, scopusIds, orcidIds, file, headers,
        originalData, scopusColumn, orcidColumn, outputMode, isLoading, error, statusText,
        progress, publicationResults, statisticsResults, deduplicationMethod, enabledServices,
        statsToCalculate, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold,
        deduplicationLog, manualReviewList, reviewIndex, reviewGroups,
        selectedFields, isReviewComplete, isGeneratingStats,
        chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType,
        chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay,
        dashboardLayouts, dashboardWidgets
    } = advancedSearchState;

    const availableFields = useMemo(() => [
        { key: 'source', labelKey: 'colSource', sources: ['Scopus', 'ORCID'] },
        { key: 'title', labelKey: 'colTitle', sources: ['Scopus', 'ORCID'] },
        { key: 'year', labelKey: 'colYear', sources: ['Scopus', 'ORCID'] },
        { key: 'pub_type', labelKey: 'colType', sources: ['Scopus', 'ORCID'] },
        { key: 'doi', labelKey: 'colDoi', sources: ['Scopus', 'ORCID'] },
        { key: 'journal', labelKey: 'colJournal', sources: ['Scopus', 'ORCID'] },
        { key: 'citedby_count', labelKey: 'colCitations', sources: ['Scopus'] },
        { key: 'h_index', labelKey: 'colHIndex', sources: ['Scopus'] },
        { key: 'volume', labelKey: 'colVolume', sources: ['Scopus', 'ORCID'] },
        { key: 'issue', labelKey: 'colIssue', sources: ['Scopus', 'ORCID'] },
        { key: 'pages', labelKey: 'colPages', sources: ['Scopus', 'ORCID'] },
        { key: 'issn', labelKey: 'colIssn', sources: ['Scopus', 'ORCID'] },
        { key: 'eissn', labelKey: 'colEissn', sources: ['Scopus', 'ORCID'] },
        { key: 'open_access', labelKey: 'colOpenAccess', sources: ['Scopus'] },
        { key: 'orcid_source', labelKey: 'colOrcidSource', sources: ['ORCID'] },
        { key: 'affil_knu', labelKey: 'colAffilKnu', sources: ['Scopus'] },
        { key: 'affil_rf', labelKey: 'colAffilRf', sources: ['Scopus'] },
    ], [t]);

    const setState = (updates: Partial<typeof advancedSearchState>) => {
        setAdvancedSearchState(prev => ({ ...prev, ...updates }));
    };

    const handleReset = () => {
        const currentFields = advancedSearchState.selectedFields;
        setAdvancedSearchState({ ...initialAdvancedSearchState, apiKey, selectedFields: currentFields });
        setResultView('table');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setState({ file: selectedFile, fileName: selectedFile.name, publicationResults: [], statisticsResults: null });
            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                        const sheetName = workbook.SheetNames[0];
                        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                        const fileHeaders = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
                        const scopusHeader = fileHeaders.find(h => h.toUpperCase().includes('SCOPUS'));
                        const orcidHeader = fileHeaders.find(h => h.toUpperCase().includes('ORCID'));
                        setState({
                            headers: fileHeaders,
                            originalData: jsonData,
                            scopusColumn: scopusHeader || fileHeaders[0] || '',
                            orcidColumn: orcidHeader || fileHeaders[0] || '',
                        });
                    } catch (err: any) {
                        setState({ error: err.message });
                    }
                };
                reader.readAsBinaryString(selectedFile);
            } catch (err: any) {
                setState({ error: err.message, file: null, fileName: '' });
            }
        }
    };
    
    const handleGenerateReport = useCallback(async () => {
        if (!apiKey) { setState({ error: t('errorApiKeyRequired') }); return; }

        const yearRange: YearRange = {
            start: startYear ? parseInt(startYear) : undefined,
            end: endYear ? parseInt(endYear) : undefined,
        };

        setState({ isLoading: true, error: null, publicationResults: [], statisticsResults: null, statusText: '', progress: null, manualReviewList: [], processStats: null, deduplicationLog: [], reviewIndex: -1, reviewGroups: [], isReviewComplete: false, isGeneratingStats: false });
        logEvent('fetch_data_start', { module: 'advanced_search' });

        try {
            let profiles: { scopusId?: string; orcidId?: string; originalRow?: any }[] = [];

            if (inputType === 'manual') {
                const scopus = scopusIds.split('\n').map(id => id.trim()).filter(Boolean);
                const orcid = orcidIds.split('\n').map(id => id.trim()).filter(Boolean);
                const maxLen = Math.max(scopus.length, orcid.length);
                for (let i = 0; i < maxLen; i++) {
                    profiles.push({ scopusId: scopus[i], orcidId: orcid[i], originalRow: { scopus: scopus[i], orcid: orcid[i] } });
                }
            } else {
                if (!file || !originalData) { setState({ error: t('errorSelectFile'), isLoading: false }); return; }
                profiles = originalData.map(row => ({
                    scopusId: row[scopusColumn]?.toString().trim(),
                    orcidId: row[orcidColumn]?.toString().trim(),
                    originalRow: row
                }));
            }
            
            if (profiles.length === 0) {
                 setState({ error: t('errorNoAuthorIds'), isLoading: false }); return;
            }

            const allFinalPubs: any[] = [];
            let totalScopusInitial = 0;
            let totalOrcidInitial = 0;
            const allDedupLogs: any[] = [];
            const allReviewGroups: any[][] = [];

            const getPriority = (pub: any) => {
                if (pub.source === 'Scopus') return 1;
                if (pub.orcid_source === "Web of Science Researcher Profile Sync") return 2;
                if (pub.orcid_source === "Scopus - Elsevier") return 3;
                if (pub.orcid_source === "author") return 10;
                return 5;
            };

            const effectiveOrcidServices: EnabledMetadataServices = enabledServices;
            
            for (let i = 0; i < profiles.length; i++) {
                const profile = profiles[i];
                setState({ progress: { current: i + 1, total: profiles.length }, statusText: t('progressProcessingAuthor', { current: i + 1, total: profiles.length, author: profile.scopusId || profile.orcidId || `Row ${i+1}` }) });

                let scopusPubs: any[] = [];
                let orcidWorks: OrcidWork[] = [];
                let hIndex: string | number | null = null;

                if (profile.scopusId) {
                    try {
                        if (selectedFields.includes('h_index') || (outputMode === 'statistics' && statsToCalculate.hIndex)) {
                            const metrics = await fetchAuthorMetrics(profile.scopusId, apiKey);
                            hIndex = metrics.hIndex;
                        }
                        const publications = await fetchAuthorPublications(profile.scopusId, apiKey, yearRange);
                        scopusPubs = publications.map(p => ({...p, author_scopus: profile.scopusId!, h_index: hIndex }));
                    } catch (e) { console.error(`Error fetching Scopus for ${profile.scopusId}:`, e); }
                }

                if (profile.orcidId) {
                     try {
                        orcidWorks = await fetchAndProcessOrcidWorks(profile.orcidId, yearRange, effectiveOrcidServices);
                     } catch (e) { console.error(`Error fetching ORCID for ${profile.orcidId}:`, e); }
                }
                
                totalScopusInitial += scopusPubs.length;
                totalOrcidInitial += orcidWorks.length;

                const scopusMapped = scopusPubs.map(p => ({ _id: `s_${p.eid || Math.random()}`, source: 'Scopus', ...p, pub_type: p.pub_type }));
                const orcidMapped = orcidWorks.map(w => ({ _id: `o_${w.put_code || Math.random()}`, source: 'ORCID', ...w, pub_type: w.type, orcid_source: w.sours }));

                const allPubsForAuthor = [...scopusMapped, ...orcidMapped];
                const duplicatesToRemove = new Set<string>();
                const potentialReviewItems: {item1: any, item2: any, score: number}[] = [];
                const dedupLogForAuthor: any[] = [];
                
                for (let j = 0; j < allPubsForAuthor.length; j++) {
                    if (duplicatesToRemove.has(allPubsForAuthor[j]._id)) continue;
                    for (let k = j + 1; k < allPubsForAuthor.length; k++) {
                         if (duplicatesToRemove.has(allPubsForAuthor[k]._id)) continue;
                        const pub1 = allPubsForAuthor[j];
                        const pub2 = allPubsForAuthor[k];
                        let isDuplicate = false, needsReview = false, similarityScore = 0;
                        const doi1 = normalizeDoi(pub1.doi), doi2 = normalizeDoi(pub2.doi);
                        const title1Norm = normalizeTitleForComparison(pub1.title), title2Norm = normalizeTitleForComparison(pub2.title);

                        if (doi1 && doi2 && doi1 === doi2) isDuplicate = true;
                        else if (deduplicationMethod === 'standard') { if (title1Norm && title2Norm && title1Norm.length > 0 && title1Norm === title2Norm) isDuplicate = true; } 
                        else {
                            if (title1Norm && title2Norm && title1Norm.length > 0 && title2Norm.length > 0) {
                                similarityScore = jaroWinkler(title1Norm, title2Norm);
                                if (similarityScore > (jaroWinklerMatchThreshold / 100)) isDuplicate = true;
                                else if (similarityScore > (jaroWinklerReviewThreshold / 100)) needsReview = true;
                            }
                        }
                        if (isDuplicate) {
                            const [keep, remove] = getPriority(pub1) <= getPriority(pub2) ? [pub1, pub2] : [pub2, pub1];
                            if (!duplicatesToRemove.has(remove._id)) {
                                duplicatesToRemove.add(remove._id);
                                dedupLogForAuthor.push({ ...remove, [t('colReasonForRemoval')]: `Duplicate by title/DOI.`, [t('colDuplicateOfTitle')]: keep.title });
                            }
                        } else if (needsReview) potentialReviewItems.push({item1: pub1, item2: pub2, score: similarityScore});
                    }
                }
                
                const reviewGroupsForAuthor: any[][] = [];
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
                                const curr = queue.shift()!;
                                currentGroup.push(nodeMap.get(curr));
                                const neighbors = adj.get(curr) || [];
                                for (const n of neighbors) { if (!visited.has(n._id)) { visited.add(n._id); queue.push(n._id); } }
                            }
                            reviewGroupsForAuthor.push(currentGroup.map(item => ({...(profile.originalRow || {}), ...item})));
                        }
                    }
                }

                const itemsForReviewIds = new Set(reviewGroupsForAuthor.flat().map(item => item._id));
                const finalPubsForAuthor = allPubsForAuthor.filter(p => !duplicatesToRemove.has(p._id) && !itemsForReviewIds.has(p._id));
                
                allFinalPubs.push(...finalPubsForAuthor.map(p => ({ ...(profile.originalRow || {}), ...p })));
                allDedupLogs.push(...dedupLogForAuthor.map(logEntry => ({ ...(profile.originalRow || {}), ...logEntry })));
                allReviewGroups.push(...reviewGroupsForAuthor);
            }
            
            const allForReviewExcel: any[] = [];
            allReviewGroups.forEach((group, groupIndex) => {
                group.forEach(item => { allForReviewExcel.push({ ...item, [t('colReviewGroupId')]: groupIndex + 1 }); });
            });

            // Prepare Chart Columns
            const selectedFieldEntries = availableFields.filter(f => selectedFields.includes(f.key));
            const baseChartCols = selectedFieldEntries.map(f => ({ accessor: f.key, header: t(f.labelKey as any) }));
            const finalChartCols = inputType === 'file' ? [...headers.map(h => ({ accessor: h, header: h })), ...baseChartCols] : baseChartCols;
            const uniqueChartCols = finalChartCols.filter((v,i,a)=>a.findIndex(t=>(t.accessor === v.accessor))===i);

            // Default Dashboard
            const defaultWidgets: DashboardWidget[] = [
                { id: 'total_pubs', type: 'total_publications' },
                { id: 'unique_authors', type: 'unique_authors', config: { authorKey: scopusColumn || orcidColumn || (inputType === 'manual' ? 'author_scopus' : '') } },
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
                publicationResults: allFinalPubs, 
                deduplicationLog: allDedupLogs, 
                manualReviewList: allForReviewExcel, 
                reviewGroups: allReviewGroups, 
                reviewIndex: allReviewGroups.length > 0 ? 0 : -1, 
                processStats: { scopusInitial: totalScopusInitial, orcidInitial: totalOrcidInitial, totalFinal: allFinalPubs.length, duplicatesRemoved: allDedupLogs.length },
                statusText: t('progressComplete', { count: allFinalPubs.length }),
                isReviewComplete: allReviewGroups.length === 0,
                chartColumns: uniqueChartCols,
                dashboardWidgets: defaultWidgets,
                dashboardLayouts: defaultLayouts,
            });
            logEvent('fetch_data_success', { module: 'advanced_search', count: allFinalPubs.length });

        } catch (err: any) {
            setState({ error: `${t('errorFetchFailed')}: ${err.message}` });
            logEvent('fetch_data_error', { module: 'advanced_search', error: err.message });
        } finally {
            setState({ isLoading: false, progress: null });
        }
    }, [apiKey, startYear, endYear, inputType, scopusIds, orcidIds, file, originalData, headers, scopusColumn, orcidColumn, outputMode, statsToCalculate, t, enabledServices, deduplicationMethod, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold, selectedFields, availableFields, setState]);
    
    const handleGenerateAndDownloadStats = async () => {
        setState({ isGeneratingStats: true, error: null, statusText: t('progressStarting') });
        try {
            if (inputType === 'file' && originalData.length > 0 && headers.length > 0) {
                const authorKeyColumn = scopusColumn || orcidColumn;
                if (!authorKeyColumn) { throw new Error(t('errorSelectSourceColumn')); }

                const statsByAuthor: Record<string, any> = {};
                const authorsToProcess = originalData.map(row => ({
                    identifier: row[authorKeyColumn],
                    scopusId: row[scopusColumn],
                    rowData: row
                })).filter(author => author.identifier && author.scopusId);

                authorsToProcess.forEach(({ identifier, rowData }) => {
                    statsByAuthor[String(identifier)] = { ...rowData, [t('colHIndex')]: 'N/A', [t('colCitations')]: 0, [t('colTotalPublications')]: 0 };
                });

                const sYear = startYear ? parseInt(startYear, 10) : 1900;
                const eYear = endYear ? parseInt(endYear, 10) : new Date().getFullYear();

                if (statsToCalculate.totalCitations) {
                    for (let i = 0; i < authorsToProcess.length; i++) {
                        const { identifier, scopusId } = authorsToProcess[i];
                        setState({ statusText: `Calculating citations for author ${i + 1} of ${authorsToProcess.length}...` });

                        if (scopusId) {
                            try {
                                const { data: citationData } = await getCitationsByYearRange(String(scopusId), sYear, eYear, apiKey, () => {});
                                const totalInRange = citationData.reduce((sum, item) => sum + item.citations, 0);
                                statsByAuthor[String(identifier)][t('colCitations')] = totalInRange;
                            } catch (e) {
                                console.error(`Failed to get citations for ${scopusId}`, e);
                                statsByAuthor[String(identifier)][t('colCitations')] = 'Error';
                            }
                        }
                         await new Promise(r => setTimeout(r, 100)); // Politeness delay
                    }
                }
                
                setState({ statusText: 'Aggregating publication data...' });

                const combinedPivotedKeys = new Set<string>();
                const scopusPivotedKeys = new Set<string>();
                const orcidPivotedKeys = new Set<string>();

                publicationResults.forEach(pub => {
                    const authorId = pub[authorKeyColumn];
                    if (authorId && statsByAuthor[authorId]) {
                        const authorStats = statsByAuthor[authorId];
                        if (statsToCalculate.hIndex && (pub.h_index !== null && pub.h_index !== undefined)) {
                            const currentH = authorStats[t('colHIndex')];
                            if (currentH === 'N/A' || Number(pub.h_index) > Number(currentH)) authorStats[t('colHIndex')] = pub.h_index;
                        }
                        
                        authorStats[t('colTotalPublications')] += 1;
                        
                        const year = pub.year;
                        const type = (pub.pub_type || pub.type || '').toLowerCase().replace(/[-_]/g, ' ').trim();

                        if (!year || !type) {
                            return;
                        }
                        
                        if (statsToCalculate.pubsByTypeAndYear) {
                            const pivotedKey = `${type} ${year}`;
                            combinedPivotedKeys.add(pivotedKey);
                            authorStats[pivotedKey] = (authorStats[pivotedKey] || 0) + 1;
                        }
                        
                        if (statsToCalculate.uniqueScopusPubsByTypeAndYear && pub.source === 'Scopus') {
                            const scopusKey = `Scopus: ${type} ${year}`;
                            scopusPivotedKeys.add(scopusKey);
                            authorStats[scopusKey] = (authorStats[scopusKey] || 0) + 1;
                        }

                        if (statsToCalculate.uniqueOrcidPubsByTypeAndYear && pub.source === 'ORCID') {
                            const orcidKey = `ORCID: ${type} ${year}`;
                            orcidPivotedKeys.add(orcidKey);
                            authorStats[orcidKey] = (authorStats[orcidKey] || 0) + 1;
                        }
                    }
                });
                
                const sortPivotedKeys = (keys: Set<string>) => Array.from(keys).sort((a, b) => {
                    const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0', 10);
                    const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0', 10);
                    if (yearA !== yearB) return yearA - yearB;
                    return a.localeCompare(b);
                });

                const sortedCombinedKeys = sortPivotedKeys(combinedPivotedKeys);
                const sortedScopusKeys = sortPivotedKeys(scopusPivotedKeys);
                const sortedOrcidKeys = sortPivotedKeys(orcidPivotedKeys);

                const finalReportData = Object.values(statsByAuthor).map(authorStats => {
                    const row: Record<string, any> = {};
                    headers.forEach(h => { row[h] = authorStats[h]; });
                    
                    if (statsToCalculate.hIndex) row[t('colHIndex')] = authorStats[t('colHIndex')];
                    if (statsToCalculate.totalCitations) row[t('colCitations')] = authorStats[t('colCitations')];
                    row[t('colTotalPublications')] = authorStats[t('colTotalPublications')];
                    
                    sortedCombinedKeys.forEach(key => { row[key] = authorStats[key] || 0; });
                    sortedScopusKeys.forEach(key => { row[key] = authorStats[key] || 0; });
                    sortedOrcidKeys.forEach(key => { row[key] = authorStats[key] || 0; });
                    
                    return row;
                });
                
                exportObjectsToXlsx(finalReportData, "advanced_search_statistics_by_author.xlsx");
                setState({ statisticsResults: null, statusText: t('advancedSearchStatReportDownloaded') });

            } else { // Manual input mode
                const stats: StatisticsResult = {};
                if (statsToCalculate.hIndex) stats.hIndex = publicationResults.map(p => Number(p.h_index)).filter(h => !isNaN(h)).reduce((max, h) => Math.max(max, h), 0);
                if (statsToCalculate.totalCitations) stats.totalCitations = publicationResults.reduce((sum, p) => sum + (Number(p.citedby_count) || 0), 0);
                
                const processPubsForStats = (pubs: any[], prefix: string = '') => {
                    const allTypes = [...new Set(pubs.map(p => (p.pub_type || p.type || 'N/A').toLowerCase().replace(/[-_]/g, ' ').trim()))].sort();
                    const allYears = [...new Set(pubs.map(p => p.year || 'N/A'))].sort();
                    
                    const headers = [t('colType'), ...allYears, t('colTotalPublications')];
                    const data: Record<string, string | number>[] = [];
                    
                    allTypes.forEach(type => {
                        const row: Record<string, string | number> = { [t('colType')]: `${prefix}${type}` };
                        let total = 0;
                        allYears.forEach(year => {
                            const count = pubs.filter(p => p.year === year && (p.pub_type || p.type || 'N/A').toLowerCase().replace(/[-_]/g, ' ').trim() === type).length;
                            row[year] = count;
                            total += count;
                        });
                        row[t('colTotalPublications')] = total;
                        data.push(row);
                    });
                    
                    return { headers, data };
                };
                
                if (statsToCalculate.pubsByTypeAndYear) stats.pubsByTypeAndYear = processPubsForStats(publicationResults);
                if (statsToCalculate.uniqueScopusPubsByTypeAndYear) stats.uniqueScopusPubsByTypeAndYear = processPubsForStats(publicationResults.filter(p => p.source === 'Scopus'), 'Scopus: ');
                if (statsToCalculate.uniqueOrcidPubsByTypeAndYear) stats.uniqueOrcidPubsByTypeAndYear = processPubsForStats(publicationResults.filter(p => p.source === 'ORCID'), 'ORCID: ');
                
                setState({ statisticsResults: stats });
            }
        } catch(err: any) {
            setState({ error: err.message });
        } finally {
            setState({ isGeneratingStats: false, statusText: '' });
        }
    };

    const handleStatToggle = (stat: keyof typeof statsToCalculate) => { setState({ statsToCalculate: { ...statsToCalculate, [stat]: !statsToCalculate[stat] } }); };
    
    const handleExportStats = () => {
        if (!statisticsResults) return;
        const sheets: {title: string, data: any[]}[] = [];

        const summaryData = [];
        if (statsToCalculate.hIndex && statisticsResults.hIndex !== undefined) summaryData.push({ 'Metric': t('advancedSearchHIndex'), 'Value': statisticsResults.hIndex });
        if (statsToCalculate.totalCitations && statisticsResults.totalCitations !== undefined) summaryData.push({ 'Metric': t('advancedSearchTotalCitations'), 'Value': statisticsResults.totalCitations });
        if(summaryData.length > 0) sheets.push({ title: t('advancedSearchSummaryMetrics'), data: summaryData });
        
        if (statsToCalculate.pubsByTypeAndYear && statisticsResults.pubsByTypeAndYear?.data.length) sheets.push({ title: t('sheetAllPubs'), data: statisticsResults.pubsByTypeAndYear.data });
        if (statsToCalculate.uniqueScopusPubsByTypeAndYear && statisticsResults.uniqueScopusPubsByTypeAndYear?.data.length) sheets.push({ title: t('sheetUniqueScopus'), data: statisticsResults.uniqueScopusPubsByTypeAndYear.data });
        if (statsToCalculate.uniqueOrcidPubsByTypeAndYear && statisticsResults.uniqueOrcidPubsByTypeAndYear?.data.length) sheets.push({ title: t('sheetUniqueOrcid'), data: statisticsResults.uniqueOrcidPubsByTypeAndYear.data });
        
        if (sheets.length > 0) {
            exportMultipleTablesToSingleXlsx(sheets, "advanced_search_statistics.xlsx");
        }
    };

    const handleServiceToggle = (service: keyof EnabledMetadataServices) => setState({ enabledServices: { ...enabledServices, [service]: !enabledServices[service] } });
    const handleMatchThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => { const newValue = parseInt(e.target.value, 10); if (newValue <= jaroWinklerReviewThreshold) { setState({ jaroWinklerMatchThreshold: newValue, jaroWinklerReviewThreshold: Math.max(80, newValue - 1) }); } else { setState({ jaroWinklerMatchThreshold: newValue }); } };
    const handleReviewThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => { const newValue = parseInt(e.target.value, 10); if (newValue >= jaroWinklerMatchThreshold) { setState({ jaroWinklerReviewThreshold: newValue, jaroWinklerMatchThreshold: Math.min(100, newValue + 1) }); } else { setState({ jaroWinklerReviewThreshold: newValue }); } };
    const handleDownloadManualReview = () => { if (manualReviewList.length > 0) exportObjectsToXlsx(manualReviewList, `manual_review_advanced_search.xlsx`); };
    const handleDownloadDedupLog = () => { if (deduplicationLog.length > 0) exportObjectsToXlsx(deduplicationLog, `deduplication_log_advanced_search.xlsx`); };
    
    const handleReviewDecision = (recordsToKeep: any[]) => {
        if (reviewIndex < 0) return;
        const similarityKey = t('colSimilarity');
        const keptRecords = recordsToKeep.map(r => {
            const { ...rest } = r;
            return rest;
        });
        const nextIndex = reviewIndex + 1;
        const isFinished = nextIndex >= reviewGroups.length;
        setState({
            publicationResults: [...publicationResults, ...keptRecords],
            reviewIndex: isFinished ? -1 : nextIndex,
            reviewGroups: isFinished ? [] : reviewGroups,
            isReviewComplete: isFinished,
        });
    };
    
    const handleFieldSelectionChange = (key: string) => { const newSelection = selectedFields.includes(key) ? selectedFields.filter(f => f !== key) : [...selectedFields, key]; setState({ selectedFields: newSelection }); };

    const handleChartConfigChange = (key: 'x' | 'yCalculation' | 'yValueColumn' | 'group' | 'type' | 'labelDisplay', value: string) => {
        const newConfig = { [`chartConfig${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
        if (key === 'type' && value === 'pie') {
            newConfig['chartConfigGroup'] = 'none';
            newConfig['chartConfigFilterGroup'] = null;
        }
        if (key === 'x') newConfig['chartConfigFilterX'] = null;
        if (key === 'group') newConfig['chartConfigFilterGroup'] = null;
        setState(newConfig as any);
    };

    const handleChartFilterChange = (key: 'x' | 'group', value: string[] | null) => {
        const newFilters = { [`chartConfigFilter${key.charAt(0).toUpperCase() + key.slice(1)}`]: value };
        setState(newFilters as any);
    };

    const displayColumns = useMemo(() => {
        const selectedCols = availableFields.filter(field => selectedFields.includes(field.key)).map(field => ({ header: t(field.labelKey as any), accessor: field.key }));
        if (inputType === 'file' && headers.length > 0) return [...headers.map(h => ({ header: h, accessor: h })), ...selectedCols];
        if (inputType === 'manual') return [{header: 'Scopus ID', accessor: 'scopus'}, {header: 'ORCID', accessor: 'orcid'}, ...selectedCols];
        return selectedCols;
    }, [selectedFields, availableFields, t, inputType, headers]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('apiKeyLabel')}</label><input type="password" value={apiKey} onChange={e => setState({ apiKey: e.target.value })} className="w-full bg-white border border-secondary-300 rounded-lg p-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={t('apiKeyPlaceholder')} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('fromYearLabel')}</label><input type="number" value={startYear} onChange={e => setState({ startYear: e.target.value })} className="w-full bg-white border border-secondary-300 rounded-lg p-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={t('yearPlaceholder')} /></div>
                    <div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('toYearLabel')}</label><input type="number" value={endYear} onChange={e => setState({ endYear: e.target.value })} className="w-full bg-white border border-secondary-300 rounded-lg p-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={t('yearPlaceholder2')} /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <fieldset className="p-4 border border-secondary-300 rounded-lg"><legend className="text-sm font-semibold px-2 text-secondary-700">{t('advancedSearchInputType')}</legend><div className="flex gap-4 p-2 bg-secondary-100 rounded-lg"><label className="flex-1 cursor-pointer"><input type="radio" value="manual" checked={inputType==='manual'} onChange={() => setState({inputType: 'manual'})} className="hidden peer"/><span className="block w-full text-center py-2 px-4 rounded-md text-sm text-secondary-800 peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('advancedSearchManualInput')}</span></label><label className="flex-1 cursor-pointer"><input type="radio" value="file" checked={inputType==='file'} onChange={() => setState({inputType: 'file'})} className="hidden peer"/><span className="block w-full text-center py-2 px-4 rounded-md text-sm text-secondary-800 peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('advancedSearchFileInput')}</span></label></div></fieldset>
                <fieldset className="p-4 border border-secondary-300 rounded-lg"><legend className="text-sm font-semibold px-2 text-secondary-700">{t('advancedSearchOutputMode')}</legend><div className="flex gap-4 p-2 bg-secondary-100 rounded-lg"><label className="flex-1 cursor-pointer"><input type="radio" value="publications" checked={outputMode==='publications'} onChange={() => setState({outputMode: 'publications'})} className="hidden peer"/><span className="block w-full text-center py-2 px-4 rounded-md text-sm text-secondary-800 peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('advancedSearchOutputPublications')}</span></label><label className="flex-1 cursor-pointer"><input type="radio" value="statistics" checked={outputMode==='statistics'} onChange={() => setState({outputMode: 'statistics'})} className="hidden peer"/><span className="block w-full text-center py-2 px-4 rounded-md text-sm text-secondary-800 peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('advancedSearchOutputStatistics')}</span></label></div></fieldset>
            </div>
            
            {inputType === 'manual' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-in-up">
                    <div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('authorIdsLabel')}</label><textarea value={scopusIds} onChange={e => setState({scopusIds: e.target.value})} rows={4} className="w-full mt-1 p-2 bg-white border border-secondary-300 rounded-lg text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/></div>
                    <div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('orcidIdsLabel')}</label><textarea value={orcidIds} onChange={e => setState({orcidIds: e.target.value})} rows={4} className="w-full mt-1 p-2 bg-white border border-secondary-300 rounded-lg text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/></div>
                </div>
            ) : (
                <div className="animate-slide-in-up">
                    {!file ? (<div onClick={() => fileInputRef.current?.click()} className="mt-1 flex justify-center p-6 border-2 border-secondary-300 border-dashed rounded-lg cursor-pointer bg-secondary-50 hover:bg-secondary-100 group"><input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" /><div className="text-center"><div className="w-12 h-12 mx-auto text-secondary-400 group-hover:text-primary-600"><UploadIcon /></div><p className="mt-2 text-sm text-primary-600 font-semibold">{t('uploadFileLink')}</p></div></div>
                    ) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('selectIdColumnLabelScopus')}</label><select value={scopusColumn} onChange={e=>setState({scopusColumn: e.target.value})} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div><div><label className="block text-sm font-medium text-secondary-700 mb-2">{t('selectIdColumnLabelOrcid')}</label><select value={orcidColumn} onChange={e=>setState({orcidColumn: e.target.value})} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div></div>)}
                </div>
            )}

            <CollapsibleSection title={t('advancedSearchDeduplicationAndMetadata')}>
                <div className="space-y-6">
                    <fieldset className="p-4 border border-secondary-200 rounded-lg">
                        <legend className="text-sm font-semibold px-2 text-secondary-600">{t('unifiedDeduplicationMethodTitle')}</legend>
                        <div className="flex flex-col gap-4 mt-2">
                            <label className="flex items-start cursor-pointer"><input type="radio" checked={deduplicationMethod === 'standard'} onChange={() => setState({ deduplicationMethod: 'standard' })} className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500" /><div className="ml-3"><span className="block text-sm font-bold text-secondary-800">{t('unifiedDeduplicationStandard')}</span><p className="text-xs text-secondary-500">{t('unifiedDeduplicationStandardDesc')}</p></div></label>
                            <label className="flex items-start cursor-pointer"><input type="radio" checked={deduplicationMethod === 'advanced'} onChange={() => setState({ deduplicationMethod: 'advanced' })} className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500" /><div className="ml-3"><span className="block text-sm font-bold text-secondary-800">{t('unifiedDeduplicationAdvanced')}</span><p className="text-xs text-secondary-500">{t('unifiedDeduplicationAdvancedDesc')}</p></div></label>
                        </div>
                        {deduplicationMethod === 'advanced' && (
                            <div className="mt-4 pl-7 space-y-4 animate-slide-in-up">
                                <div><label className="block text-xs font-medium text-secondary-600 mb-1">{t('unifiedMatchThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerMatchThreshold}%</span></label><input type="range" min="90" max="100" value={jaroWinklerMatchThreshold} onChange={handleMatchThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" /></div>
                                <div><label className="block text-xs font-medium text-secondary-600 mb-1">{t('unifiedReviewThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerReviewThreshold}%</span></label><input type="range" min="80" max="96" value={jaroWinklerReviewThreshold} onChange={handleReviewThresholdChange} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" /></div>
                            </div>
                        )}
                    </fieldset>
                    <fieldset className="p-4 border border-secondary-200 rounded-lg">
                        <legend className="text-sm font-semibold px-2 text-secondary-600">{t('orcidMetadataSourcesTitle')}</legend>
                        <div className="flex flex-wrap gap-6 mt-2">
                            {[
                                { key: 'crossref' as const, labelKey: 'orcidMetadataSourceCrossRef' },
                                { key: 'datacite' as const, labelKey: 'orcidMetadataSourceDataCite' },
                                { key: 'zenodo' as const, labelKey: 'orcidMetadataSourceZenodo' },
                            ].map(service => (
                                <label key={service.key} className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enabledServices[service.key]}
                                        onChange={() => handleServiceToggle(service.key)}
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 rounded"
                                    />
                                    <span className="ml-2 text-sm text-secondary-800">{t(service.labelKey)}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </div>
            </CollapsibleSection>
            
            {outputMode === 'publications' && (
              <div className="space-y-6 animate-slide-in-up">
                <CollapsibleSection title={t('advancedSearchFieldsToFetch')}>
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setState({ selectedFields: availableFields.map(f => f.key) })} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}</button>
                        <span className="text-secondary-300">|</span>
                        <button onClick={() => setState({ selectedFields: [] })} className="text-xs font-semibold text-primary-600 hover:underline">{t('deselectAll')}</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                        {availableFields.map(field => (
                            <label key={field.key} className="flex items-center p-1 hover:bg-primary-50 rounded cursor-pointer">
                                <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => handleFieldSelectionChange(field.key)} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"/>
                                <span className="ml-2 block text-sm text-secondary-700 truncate">{t(field.labelKey as any)}</span>
                                <span className="ml-1 text-xs text-secondary-400">({field.sources.join(', ')})</span>
                            </label>
                        ))}
                    </div>
                </CollapsibleSection>
              </div>
            )}
            
            {outputMode === 'statistics' && (
                <div className="space-y-6 animate-slide-in-up">
                    <CollapsibleSection title={t('advancedSearchStatisticsOptions')}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.keys(statsToCalculate).map((statKey) => (
                                <label key={statKey} className="flex items-center p-2 hover:bg-primary-50 rounded cursor-pointer border border-secondary-200 bg-white shadow-sm">
                                    <input type="checkbox" checked={statsToCalculate[statKey as keyof typeof statsToCalculate]} onChange={() => handleStatToggle(statKey as keyof typeof statsToCalculate)} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                                    <span className="ml-2 text-sm font-medium text-secondary-700">{t(`advancedSearch${statKey.charAt(0).toUpperCase() + statKey.slice(1)}` as any)}</span>
                                </label>
                            ))}
                        </div>
                         <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                           {t('advancedSearchStatsMetadataReminder')}
                        </div>
                    </CollapsibleSection>
                </div>
            )}
            
            <div className="flex justify-end items-center gap-4 pt-2">
                <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg flex items-center gap-2 hover:bg-secondary-300 transition-colors"><RefreshIcon /><span>{t('resetButton')}</span></button>
                <button onClick={handleGenerateReport} disabled={isLoading} className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-colors">{isLoading ? <Loader /> : t('advancedSearchGenerateButton')}</button>
            </div>
            
            {(isLoading || isGeneratingStats) && <ProgressBar current={progress?.current || 0} total={progress?.total || 1} text={statusText}/>}
            {error && <ErrorMessage message={error} />}
            {!isLoading && statusText && !error && !publicationResults.length && !statisticsResults && <div className="p-4 bg-green-100 text-green-700 rounded-lg">{statusText}</div>}

            {!isLoading && reviewIndex > -1 && (
                <div className="mt-6"><InteractiveReview key={reviewIndex} group={reviewGroups[reviewIndex]} currentIndex={reviewIndex} total={reviewGroups.length} onDecision={handleReviewDecision} /></div>
            )}

            {!isLoading && reviewIndex === -1 && publicationResults.length > 0 && (
                <div className="space-y-6 animate-slide-in-up">
                    
                    <div className="border-b border-secondary-200 mb-4">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => setResultView('table')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${resultView === 'table' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                {outputMode === 'statistics' ? t('statsTabReports') : 'Table'}
                            </button>
                            <button onClick={() => setResultView('chart')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${resultView === 'chart' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                {t('statsTabVisualization')}
                            </button>
                            <button onClick={() => setResultView('dashboard')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${resultView === 'dashboard' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                                {t('statsTabDashboard')}
                            </button>
                        </nav>
                    </div>

                    {resultView === 'table' && (
                        <div className="space-y-6 animate-slide-in-up">
                             {outputMode === 'publications' && (
                                <div className="flex flex-wrap gap-4">
                                    {manualReviewList.length > 0 && <button onClick={handleDownloadManualReview} className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-4 rounded-lg shadow"><DownloadIcon />{t('unifiedDownloadManualReview')}</button>}
                                    {deduplicationLog.length > 0 && <button onClick={handleDownloadDedupLog} className="flex items-center gap-2 bg-secondary-300 hover:bg-secondary-400 text-secondary-800 font-bold py-2 px-4 rounded-lg shadow"><DownloadIcon />{t('unifiedDownloadDedupLog')}</button>}
                                </div>
                            )}

                            {outputMode === 'statistics' && isReviewComplete && !statisticsResults && (
                                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-blue-800">{t('advancedSearchPreviewTitle')}</h4>
                                            <p className="text-sm text-blue-700 mt-1">{t('advancedSearchPreviewDescription')}</p>
                                        </div>
                                        <button onClick={handleGenerateAndDownloadStats} disabled={isGeneratingStats} className="w-full sm:w-auto flex items-center justify-center gap-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg hover:shadow-xl transition-all duration-300 shadow-md">
                                            {isGeneratingStats ? <Loader /> : <DownloadIcon />}
                                            <span>{t('advancedSearchGenerateDownloadReport')}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <DataTable columns={displayColumns as any} data={publicationResults} filename="advanced_search_publications.xlsx" fixedHeight />

                             {outputMode === 'statistics' && statisticsResults && (
                                <div className="mt-8 animate-slide-in-up">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-2xl font-bold text-secondary-800">{t('advancedSearchResultsTitle')}</h3>
                                        <button onClick={handleExportStats} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow"><DownloadIcon />{t('advancedSearchDownloadStats')}</button>
                                    </div>
                                    <div className="p-6 bg-white rounded-2xl border border-secondary-200 shadow-lg space-y-8">
                                        {(statsToCalculate.hIndex || statsToCalculate.totalCitations) && (
                                            <div><h4 className="font-semibold text-lg text-secondary-700 mb-3">{t('advancedSearchSummaryMetrics')}</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{statisticsResults.hIndex !== undefined && statsToCalculate.hIndex && (<div className="p-4 bg-secondary-50 rounded-lg text-center"><p className="text-sm text-secondary-500 font-semibold uppercase">{t('advancedSearchHIndex')}</p><p className="text-3xl font-bold text-primary-600">{statisticsResults.hIndex ?? 'N/A'}</p></div>)}{statisticsResults.totalCitations !== undefined && statsToCalculate.totalCitations && (<div className="p-4 bg-secondary-50 rounded-lg text-center"><p className="text-sm text-secondary-500 font-semibold uppercase">{t('advancedSearchTotalCitations')}</p><p className="text-3xl font-bold text-primary-600">{statisticsResults.totalCitations.toLocaleString()}</p></div>)}</div></div>
                                        )}
                                        {statisticsResults.pubsByTypeAndYear && (
                                            <div><h4 className="font-semibold text-lg text-secondary-700 mb-3">{t('advancedSearchPubsByTypeAndYear')}</h4><div className="overflow-x-auto max-h-96 border rounded-lg shadow-sm"><table className="min-w-full divide-y divide-secondary-200 text-sm"><thead className="bg-secondary-50 sticky top-0"><tr>{statisticsResults.pubsByTypeAndYear.headers.map(h => (<th key={h} className="px-4 py-2 text-left font-bold text-secondary-600">{h}</th>))}</tr></thead><tbody className="bg-white divide-y divide-secondary-200">{statisticsResults.pubsByTypeAndYear.data.map((row, idx) => (<tr key={idx} className="hover:bg-primary-50 transition-colors">{statisticsResults.pubsByTypeAndYear!.headers.map(h => (<td key={`${idx}-${h}`} className="px-4 py-2 text-secondary-700">{row[h]}</td>))}</tr>))}</tbody></table></div></div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {resultView === 'chart' && (
                        <div className="animate-slide-in-up">
                            <ChartConstructor 
                                data={publicationResults}
                                columns={chartColumns}
                                config={{ 
                                    x: chartConfigX, 
                                    yCalculation: chartConfigYCalculation, 
                                    yValueColumn: chartConfigYValueColumn, 
                                    group: chartConfigGroup, 
                                    type: chartConfigType, 
                                    labelDisplay: chartConfigLabelDisplay 
                                }}
                                onConfigChange={handleChartConfigChange as any}
                                filters={{ x: chartConfigFilterX, group: chartConfigFilterGroup }}
                                onFilterChange={handleChartFilterChange}
                            />
                        </div>
                    )}

                    {resultView === 'dashboard' && (
                        <div className="animate-slide-in-up">
                            <Dashboard
                                data={publicationResults}
                                layouts={dashboardLayouts}
                                widgets={dashboardWidgets}
                                onLayoutsChange={(layouts) => setState({ dashboardLayouts: layouts })}
                                onWidgetsChange={(widgets) => setState({ dashboardWidgets: widgets })}
                                columns={chartColumns}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedSearchTab;
