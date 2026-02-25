
import React, { useMemo, useRef } from 'react';
import DataTable, { Column } from './DataTable';
import Loader from './Loader';
import { UploadIcon } from './icons/UploadIcon';
import ErrorMessage from './ErrorMessage';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialBatchState, DataSource, DashboardWidget, BatchTabState } from '../contexts/TabsStateContext';
import ChartConstructor from './ChartConstructor';
import Dashboard from './Dashboard';
import { jaroWinkler, normalizeTitleForComparison } from '../utils/jaroWinkler';
import InteractiveReview from './InteractiveReview';
import { logEvent } from '../services/analyticsService';

declare const XLSX: any;

const BatchTab: React.FC = () => {
  const { batchState, setBatchState } = useTabsState();
  const { 
    dataSources, isLoading, error, table1Name, key1, table2Name, key2, columnsToAdd, processedData, insertionPoint,
    mode, dedupPrimaryTable, dedupColumnConfig,
    fillGroupHeaderColumn, fillGroupNewColumnName, fillGroupInsertAfterColumn,
    chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType, chartConfigFilterX, chartConfigFilterGroup, chartConfigLabelDisplay,
    dashboardLayouts, dashboardWidgets,
    dedupScope, dedupGroupColumn, dedupCompareColumns, jaroWinklerMatchThreshold, jaroWinklerReviewThreshold, reviewGroups, reviewIndex
  } = batchState;
  
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visualizeView, setVisualizeView] = useState<'chart' | 'dashboard'>('chart');
  
  const setState = (updates: Partial<BatchTabState>) => {
    setBatchState(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    const currentState = batchState;
    setBatchState({...initialBatchState, mode: currentState.mode});
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Explicitly type `files` as File[] to resolve type inference issues.
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if ((mode === 'visualize' || mode === 'fillGroup' || mode === 'interactiveDeduplicate') && files.length > 0) {
        handleFiles([files[0]]);
    } else if (files.length > 0) {
        handleFiles(files);
    }
  };
  
  const handleFiles = (files: File[]) => {
      setState({ isLoading: true, error: null, processedData: null });
      const newSources: DataSource[] = [];
      let processedCount = 0;

      if (files.length === 0) {
          setState({ isLoading: false });
          return;
      }
      
      files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const data = e.target?.result;
                  const workbook = XLSX.read(data, { type: 'binary' });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  
                  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
                  const headers: string[] = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

                  if (headers.length > 0) {
                      newSources.push({
                          name: file.name,
                          headers,
                          data: jsonData,
                      });
                  }
              } catch (err: any) {
                  setState({ error: `${t('errorExcelParse')}: ${err.message}` });
              } finally {
                  processedCount++;
                  if (processedCount === files.length) {
                      if (mode === 'visualize' || mode === 'fillGroup' || mode === 'interactiveDeduplicate') {
                          const source = newSources[0];
                          if (source) {
                                const defaultWidgets: DashboardWidget[] = [
                                    { id: `total_rows_${Date.now()}`, type: 'total_publications' },
                                    { id: `custom_chart_${Date.now()}`, type: 'custom_chart', name: t('dashboardWidgetCustomChart'), config: { x: source.headers[0] || '', y: 'count', group: 'none', chartType: 'bar', filters: { x: null, group: null } } },
                                ];
                                const defaultLayouts = {
                                    lg: [
                                        { i: defaultWidgets[0].id, x: 0, y: 0, w: 4, h: 2 },
                                        { i: defaultWidgets[1].id, x: 4, y: 0, w: 8, h: 6 },
                                    ],
                                };
                              
                              const updates: Partial<BatchTabState> = {
                                  dataSources: [source],
                                  isLoading: false,
                                  processedData: null,
                              };
                              if (mode === 'visualize') {
                                updates.chartColumns = source.headers.map(h => ({ accessor: h, header: h }));
                                updates.chartConfigX = source.headers[0] || '';
                                updates.dashboardWidgets = defaultWidgets;
                                updates.dashboardLayouts = defaultLayouts;
                              }
                              if (mode === 'fillGroup') {
                                updates.fillGroupHeaderColumn = source.headers[0] || '';
                                updates.fillGroupInsertAfterColumn = source.headers[source.headers.length - 1] || '';
                              }
                              if (mode === 'interactiveDeduplicate') {
                                  updates.dedupGroupColumn = source.headers[0] || '';
                                  updates.dedupCompareColumns = [];
                              }

                              setState(updates as any);
                          } else {
                              setState({ isLoading: false });
                          }
                      } else {
                          const existingNames = new Set(dataSources.map(ds => ds.name));
                          const uniqueNewSources = newSources.filter(ns => !existingNames.has(ns.name));
                          setState({ 
                              dataSources: [...dataSources, ...uniqueNewSources],
                              isLoading: false
                          });
                      }
                  }
              }
          };
          reader.onerror = () => {
              setState({ error: t('errorFileRead'), isLoading: false });
              processedCount++;
          };
          reader.readAsBinaryString(file);
      });
  };

  const handleRemoveDataSource = (name: string) => {
    const newSources = dataSources.filter(ds => ds.name !== name);
    const newTable1Name = table1Name === name ? '' : table1Name;
    const newTable2Name = table2Name === name ? '' : table2Name;
    
    const newDedupConfig = { ...dedupColumnConfig };
    delete newDedupConfig[name];

    setState({ 
        dataSources: newSources,
        table1Name: newTable1Name,
        table2Name: newTable2Name,
        dedupPrimaryTable: dedupPrimaryTable === name ? '' : dedupPrimaryTable,
        dedupColumnConfig: newDedupConfig,
        processedData: null,
    });
  };

  const handleMerge = () => {
    setState({ isLoading: true, error: null, processedData: null });
    
    const table1 = dataSources.find(ds => ds.name === table1Name);
    const table2 = dataSources.find(ds => ds.name === table2Name);

    if (!table1 || !table2 || !key1 || !key2 || columnsToAdd.length === 0) {
        setState({ error: t('batchErrorMissingConfig'), isLoading: false });
        return;
    }

    logEvent('batch_process', {
        mode: 'merge',
        primary_table: table1.name,
        secondary_table: table2.name,
        primary_rows: table1.data.length,
        secondary_rows: table2.data.length,
        columns_added: columnsToAdd.length,
    });



    try {
        const normalizeKey = (value: any): string => String(value ?? '').toLowerCase().trim();

        const table2Map = new Map<string, Record<string, any>>();
        for (const row of table2.data) {
            const normalizedKey = normalizeKey(row[key2]);
            if (normalizedKey) {
                table2Map.set(normalizedKey, row);
            }
        }

        const newMergedData = table1.data.map(row1 => {
            const normalizedKey = normalizeKey(row1[key1]);
            const matchingRow2 = normalizedKey ? table2Map.get(normalizedKey) : undefined;

            if (insertionPoint.position === 'replace') {
                const newRow = { ...row1 };
                const columnToReplace = insertionPoint.column;
                const replacementSourceColumn = columnsToAdd[0]; 
                const additionalColumns = columnsToAdd.slice(1);

                newRow[columnToReplace] = matchingRow2 ? matchingRow2[replacementSourceColumn] ?? '' : '';

                additionalColumns.forEach(col => {
                    newRow[col] = matchingRow2 ? matchingRow2[col] ?? '' : '';
                });
                return newRow;
            }

            const newColumns: Record<string, any> = {};
            columnsToAdd.forEach(col => {
                newColumns[col] = matchingRow2 ? matchingRow2[col] ?? '' : '';
            });

            if (!insertionPoint || insertionPoint.position === 'end') {
                return { ...row1, ...newColumns };
            }

            const mergedRow: Record<string, any> = {};
            const anchorColumn = insertionPoint.column;
            const position = insertionPoint.position;

            for (const col of Object.keys(row1)) {
                if (col === anchorColumn && position === 'before') {
                    Object.assign(mergedRow, newColumns);
                }
                
                mergedRow[col] = row1[col];

                if (col === anchorColumn && position === 'after') {
                    Object.assign(mergedRow, newColumns);
                }
            }
            return mergedRow;
        });

        setState({ processedData: newMergedData, isLoading: false });

    } catch (err: any) {
        setState({ error: `${t('batchErrorOnMerge')}: ${err.message}`, isLoading: false });
    }
  };

  const handleDeduplicate = () => {
    setState({ isLoading: true, error: null, processedData: null });
    
    const configuredTables = Object.keys(dedupColumnConfig);
    if (!dedupPrimaryTable || configuredTables.length === 0) {
      setState({ error: t('dedupErrorConfig'), isLoading: false });
      return;
    }
    const columnCounts = configuredTables.map(name => (dedupColumnConfig[name] as string[]).length);
    if (columnCounts.some(count => count === 0)) {
        setState({ error: t('dedupErrorSelectAtLeastOne'), isLoading: false });
        return;
    }
    if (new Set(columnCounts).size > 1) {
        setState({ error: t('dedupErrorMismatch'), isLoading: false });
        return;
    }

    logEvent('batch_process', {
        mode: 'deduplicate',
        table_count: dataSources.length,
        priority_table: dedupPrimaryTable,
        comparison_column_count: columnCounts[0],
    });


    
    try {
      const priorityList = [dedupPrimaryTable, ...dataSources.map(ds => ds.name).filter(name => name !== dedupPrimaryTable)];
      
      const allRows = dataSources
        .filter(ds => configuredTables.includes(ds.name))
        .flatMap(ds => 
          ds.data.map(row => ({
            ...row,
            _source: ds.name,
            _priority: priorityList.indexOf(ds.name)
          }))
        );

      const uniqueMap = new Map<string, any>();

      allRows.forEach(row => {
        const columnsToUse = dedupColumnConfig[row._source];
        if(!columnsToUse) return;

        const compositeKey = columnsToUse
            .map(colName => String(row[colName] ?? '').toLowerCase().trim())
            .join('||');
            
        if (!compositeKey) return;

        const existingEntry = uniqueMap.get(compositeKey);
        if (!existingEntry || row._priority < existingEntry._priority) {
            uniqueMap.set(compositeKey, row);
        }
      });
      
      const finalData = Array.from(uniqueMap.values()).map(row => {
        const { _source: _s, _priority: _p, ...rest } = row;
        return rest;
      });

      setState({ processedData: finalData, isLoading: false });

    } catch(err: any) {
       setState({ error: `${t('batchErrorOnMerge')}: ${err.message}`, isLoading: false });
    }
  };

  const handleFillByGroup = () => {
    setState({ isLoading: true, error: null, processedData: null });

    if (dataSources.length === 0) {
        setState({ error: t('fillGroupNeedOneFile'), isLoading: false });
        return;
    }

    const source = dataSources[0];
    const { headers, data } = source;
    
    if (headers.length <= 1) {
        setState({ error: t('fillGroupErrorOneColumn'), isLoading: false });
        return;
    }

    if (!fillGroupHeaderColumn || !fillGroupNewColumnName || !fillGroupInsertAfterColumn) {
        setState({ error: t('fillGroupErrorConfig'), isLoading: false });
        return;
    }

    logEvent('batch_process', {
        mode: 'fill_by_group',
        table: source.name,
        rows: data.length,
    });



    try {
        let currentGroupValue = '';
        const newData: Record<string, any>[] = [];

        for (const row of data) {
            const headerValue = row[fillGroupHeaderColumn];
            let filledCellCount = 0;
            let headerColumnHasValue = false;
            
            for (const h of headers) {
                const value = row[h];
                if (value !== null && value !== undefined && String(value).trim() !== '') {
                    filledCellCount++;
                    if (h === fillGroupHeaderColumn) {
                        headerColumnHasValue = true;
                    }
                }
            }
            
            const isHeaderRow = headerColumnHasValue && filledCellCount === 1;

            if (isHeaderRow) {
                currentGroupValue = String(headerValue).trim();
            } else {
                const newRow = { ...row };
                newRow[fillGroupNewColumnName] = currentGroupValue;
                newData.push(newRow);
            }
        }
        
        const originalHeaders = [...headers];
        const newHeaders = [...originalHeaders];
        const insertAtIndex = newHeaders.indexOf(fillGroupInsertAfterColumn) + 1;
        newHeaders.splice(insertAtIndex, 0, fillGroupNewColumnName);

        const finalData = newData.map(row => {
            const orderedRow: Record<string, any> = {};
            for (const header of newHeaders) {
                orderedRow[header] = row[header];
            }
            return orderedRow;
        });

        setState({ processedData: finalData, isLoading: false });

    } catch (err: any) {
        setState({ error: `${t('batchErrorOnMerge')}: ${err.message}`, isLoading: false });
    }
  };

  const handleInteractiveDeduplicate = () => {
    setState({ isLoading: true, error: null, processedData: null, reviewGroups: [], reviewIndex: -1, processStats: null });

    const source = dataSources[0];
    if (!source || dedupCompareColumns.length === 0) {
        setState({ error: t('dedupErrorConfigInteractive'), isLoading: false });
        return;
    }

    logEvent('batch_process', {
        mode: 'interactive_deduplicate',
        scope: dedupScope,
        table: source.name,
        rows: source.data.length,
    });



    const dataToProcess = source.data.map((row, index) => ({ ...row, _id: `row_${index}` }));

    let groups: Record<string, any[]> = { 'all': dataToProcess };
    if (dedupScope === 'group' && dedupGroupColumn) {
        groups = dataToProcess.reduce((acc: Record<string, any[]>, row) => {
            const key = row[dedupGroupColumn] || 'N/A';
            if (!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
    }

    const allFinalPubs: any[] = [];
    const allReviewGroups: any[][] = [];
    
    Object.values(groups).forEach(groupData => {
        const duplicatesToRemove = new Set<string>();
        const potentialReviewItems: { item1: any, item2: any, score: number }[] = [];

        for (let i = 0; i < groupData.length; i++) {
            if (duplicatesToRemove.has(groupData[i]._id)) continue;
            for (let j = i + 1; j < groupData.length; j++) {
                if (duplicatesToRemove.has(groupData[j]._id)) continue;

                const pub1 = groupData[i];
                const pub2 = groupData[j];
                let isDuplicate = false;
                let needsReview = false;
                let similarityScore = 0;

                const title1Norm = dedupCompareColumns.map(col => normalizeTitleForComparison(pub1[col])).join(' ');
                const title2Norm = dedupCompareColumns.map(col => normalizeTitleForComparison(pub2[col])).join(' ');
                
                if (title1Norm.length > 0 && title2Norm.length > 0) {
                    similarityScore = jaroWinkler(title1Norm, title2Norm);
                    if (similarityScore > (jaroWinklerMatchThreshold / 100)) {
                        isDuplicate = true;
                    } else if (similarityScore > (jaroWinklerReviewThreshold / 100)) {
                        needsReview = true;
                    }
                }

                if (isDuplicate) {
                    duplicatesToRemove.add(pub2._id);
                } else if (needsReview) {
                    potentialReviewItems.push({ item1: pub1, item2: pub2, score: similarityScore });
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
                        duplicatesToRemove.add(currentNodeId);
                        const neighbors = adj.get(currentNodeId) || [];
                        for (const neighbor of neighbors) {
                            if (!visited.has(neighbor._id)) {
                                visited.add(neighbor._id);
                                queue.push(neighbor._id);
                            }
                        }
                    }
                    allReviewGroups.push(currentGroup);
                }
            }
        }
        const finalPubsInGroup = groupData.filter(p => !duplicatesToRemove.has(p._id));
        allFinalPubs.push(...finalPubsInGroup);
    });

    setState({
        processedData: allFinalPubs,
        reviewGroups: allReviewGroups,
        reviewIndex: allReviewGroups.length > 0 ? 0 : -1,
        processStats: { initial: dataToProcess.length, final: allFinalPubs.length, review: allReviewGroups.length },
        isLoading: false,
    });
  };
  
  const handleReviewDecision = (recordsToKeep: any[]) => {
    // Fix: Use `setBatchState` directly for functional updates as the custom `setState` helper does not support them.
    setBatchState(prev => ({
        ...prev,
        processedData: [...(prev.processedData || []), ...recordsToKeep.map(r => { const { _id: _i, ...rest } = r; return rest; })],
        reviewIndex: prev.reviewIndex + 1 >= prev.reviewGroups.length ? -1 : prev.reviewIndex + 1
    }));
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Fix: Explicitly type `files` as File[] to resolve type inference issues.
      // Fix: Explicitly type `files` as File[] to resolve type inference issues.
      const files: File[] = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      if ((mode === 'visualize' || mode === 'fillGroup' || mode === 'interactiveDeduplicate') && files.length > 0) {
          handleFiles([files[0]]);
      } else if (files.length > 0) {
          handleFiles(files);
      }
  };

  const table1 = useMemo(() => dataSources.find(ds => ds.name === table1Name), [dataSources, table1Name]);
  const table2 = useMemo(() => dataSources.find(ds => ds.name === table2Name), [dataSources, table2Name]);

  const columnsForTable2 = useMemo(() => {
      if (!table2 || !key2) return [];
      return table2.headers.filter(h => h !== key2);
  }, [table2, key2]);

  const toggleAllColumns = () => {
      if (columnsToAdd.length === columnsForTable2.length) {
          setState({ columnsToAdd: [] });
      } else {
          setState({ columnsToAdd: columnsForTable2 });
      }
  };

  const handleDedupColumnChange = (tableName: string, column: string) => {
    const currentSelection = dedupColumnConfig[tableName] || [];
    const newSelection = currentSelection.includes(column)
        ? currentSelection.filter(c => c !== column)
        : [...currentSelection, column];
    setState({
        dedupColumnConfig: {
            ...dedupColumnConfig,
            [tableName]: newSelection
        }
    });
  };
  
  const processedColumns: Column<Record<string, any>>[] = useMemo(() => {
      if (!processedData || processedData.length === 0) return [];
      return Object.keys(processedData[0]).map(key => ({
          header: key,
          accessor: key
      }));
  }, [processedData]);
  
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

  const isMergeButtonDisabled = isLoading || dataSources.length < 2 || !table1Name || !table2Name || !key1 || !key2 || columnsToAdd.length === 0 || (insertionPoint.position !== 'end' && !insertionPoint.column);
  const isDeduplicateButtonDisabled = isLoading || !dedupPrimaryTable || Object.keys(dedupColumnConfig).length < 1 || new Set(Object.values(dedupColumnConfig).map(v => (v as string[]).length)).size > 1 || Object.values(dedupColumnConfig).some(v => (v as string[]).length === 0);
  const isFillGroupButtonDisabled = isLoading || dataSources.length !== 1 || !fillGroupHeaderColumn || !fillGroupNewColumnName || !fillGroupInsertAfterColumn;
  const isInteractiveDeduplicateButtonDisabled = isLoading || dataSources.length !== 1 || dedupCompareColumns.length === 0;

  const renderMergeConfig = () => (
     <div className="p-4 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4 animate-slide-in-up">
        <fieldset className="border border-secondary-200 rounded p-3">
            <legend className="text-sm font-semibold px-1 text-secondary-600">{t('batchSelectPrimaryTable')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={table1Name} onChange={e => setState({ table1Name: e.target.value, key1: '', insertionPoint: initialBatchState.insertionPoint })} className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">-- {t('batchSelectTable')} --</option>
                    {dataSources.map(ds => <option key={ds.name} value={ds.name}>{ds.name}</option>)}
                </select>
                <select value={key1} onChange={e => setState({ key1: e.target.value })} disabled={!table1} className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-secondary-200">
                    <option value="">-- {t('batchSelectKey')} --</option>
                    {table1?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
        </fieldset>
        
        <fieldset className="border border-secondary-200 rounded p-3">
            <legend className="text-sm font-semibold px-1 text-secondary-600">{t('batchSelectSecondaryTable')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={table2Name} onChange={e => setState({ table2Name: e.target.value, key2: '', columnsToAdd: [] })} className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">-- {t('batchSelectTable')} --</option>
                    {dataSources.filter(ds => ds.name !== table1Name).map(ds => <option key={ds.name} value={ds.name}>{ds.name}</option>)}
                </select>
                <select value={key2} onChange={e => setState({ key2: e.target.value, columnsToAdd: [] })} disabled={!table2} className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-secondary-200">
                    <option value="">-- {t('batchSelectKey')} --</option>
                    {table2?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
        </fieldset>
        
        {table2 && key2 && (
            <fieldset className="border border-secondary-200 rounded p-3 animate-slide-in-up">
                <legend className="text-sm font-semibold px-1 text-secondary-600">{t('batchSelectColumnsToAdd')}</legend>
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={toggleAllColumns} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}/{t('deselectAll')}</button>
                </div>
                <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-secondary-50 rounded">
                    {columnsForTable2.map(col => (
                        <div key={col} className="flex items-center">
                            <input 
                                type="checkbox" 
                                id={`col-${col}`}
                                value={col}
                                checked={columnsToAdd.includes(col)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setState({ columnsToAdd: [...columnsToAdd, col] });
                                    } else {
                                        setState({ columnsToAdd: columnsToAdd.filter(c => c !== col) });
                                    }
                                }}
                                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor={`col-${col}`} className="ml-2 text-sm text-secondary-700 truncate cursor-pointer">{col}</label>
                        </div>
                    ))}
                </div>
            </fieldset>
        )}

        {table1 && (
            <fieldset className="border border-secondary-200 rounded p-3 animate-slide-in-up">
                <legend className="text-sm font-semibold px-1 text-secondary-600">{t('batchInsertionPointTitle')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select 
                        value={insertionPoint.position} 
                        onChange={e => setState({ insertionPoint: { ...insertionPoint, position: e.target.value as any }})}
                        className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                        <option value="end">{t('batchInsertAtEnd')}</option>
                        <option value="before">{t('batchInsertBefore')}</option>
                        <option value="after">{t('batchInsertAfter')}</option>
                        <option value="replace">{t('batchReplaceColumn')}</option>
                    </select>
                    <select 
                        value={insertionPoint.column}
                        onChange={e => setState({ insertionPoint: { ...insertionPoint, column: e.target.value }})}
                        disabled={insertionPoint.position === 'end'}
                        className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-secondary-200"
                    >
                        <option value="">-- {t('batchSelectTargetColumn')} --</option>
                        {table1.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            </fieldset>
        )}
    </div>
  );

  const renderDeduplicateConfig = () => (
      <div className="p-4 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4 animate-slide-in-up">
        <fieldset className="border border-secondary-200 rounded p-3">
            <legend className="text-sm font-semibold px-1 text-secondary-600">{t('dedupPrimarySourceTitle')}</legend>
            <select value={dedupPrimaryTable} onChange={e => setState({ dedupPrimaryTable: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">-- {t('batchSelectTable')} --</option>
                {dataSources.map(ds => <option key={ds.name} value={ds.name}>{ds.name}</option>)}
            </select>
        </fieldset>

         <fieldset className="border border-secondary-200 rounded p-3">
            <legend className="text-sm font-semibold px-1 text-secondary-600">{t('dedupColumnsTitle')}</legend>
            <p className="text-xs text-secondary-500 mb-3">{t('dedupColumnsInstruction')}</p>
             <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {dataSources.map(ds => {
                    const selectedCount = dedupColumnConfig[ds.name]?.length || 0;
                    return (
                        <div key={ds.name} className="p-3 bg-secondary-50/50 rounded-md border">
                             <h4 className="font-semibold text-secondary-800">{ds.name}</h4>
                             <p className="text-xs text-secondary-600 mb-2">{t('dedupSelectedCount', {count: selectedCount})}</p>
                             <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1">
                                {ds.headers.map(header => (
                                     <div key={`${ds.name}-${header}`} className="flex items-center">
                                        <input 
                                            type="checkbox" 
                                            id={`dedup-${ds.name}-${header}`}
                                            checked={dedupColumnConfig[ds.name]?.includes(header) || false}
                                            onChange={() => handleDedupColumnChange(ds.name, header)}
                                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <label htmlFor={`dedup-${ds.name}-${header}`} className="ml-2 text-sm text-secondary-700 truncate cursor-pointer">{header}</label>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )
                })}
             </div>
         </fieldset>
      </div>
  );

  const renderFillGroupConfig = () => {
    const source = dataSources[0];
    if (!source) return null;

    return (
        <div className="p-4 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4 animate-slide-in-up">
            <div>
                <label htmlFor="fill-group-header-col" className="block text-sm font-medium text-secondary-600 mb-2">{t('fillGroupHeaderColumnLabel')}</label>
                <select id="fill-group-header-col" value={fillGroupHeaderColumn} onChange={e => setState({ fillGroupHeaderColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">-- {t('batchSelectKey')} --</option>
                    {source.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="fill-group-new-col-name" className="block text-sm font-medium text-secondary-600 mb-2">{t('fillGroupNewColumnNameLabel')}</label>
                <input id="fill-group-new-col-name" type="text" value={fillGroupNewColumnName} onChange={e => setState({ fillGroupNewColumnName: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
                <label htmlFor="fill-group-insert-after" className="block text-sm font-medium text-secondary-600 mb-2">{t('fillGroupInsertAfterLabel')}</label>
                <select id="fill-group-insert-after" value={fillGroupInsertAfterColumn} onChange={e => setState({ fillGroupInsertAfterColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">-- {t('batchSelectKey')} --</option>
                    {source.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
        </div>
    );
  };

   const renderInteractiveDeduplicateConfig = () => {
        const source = dataSources[0];
        if (!source) return null;

        const handleCompareColumnChange = (col: string) => {
            const newSelection = dedupCompareColumns.includes(col)
                ? dedupCompareColumns.filter(c => c !== col)
                : [...dedupCompareColumns, col];
            setState({ dedupCompareColumns: newSelection });
        };

        return (
            <div className="p-4 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4 animate-slide-in-up">
                <fieldset className="border border-secondary-200 rounded p-3">
                    <legend className="text-sm font-semibold px-1 text-secondary-600">{t('dedupScopeLabel')}</legend>
                    <div className="flex gap-4">
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" value="document" checked={dedupScope === 'document'} onChange={e => setState({ dedupScope: e.target.value as any })} className="h-4 w-4 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                            <span className="ml-2 text-sm text-secondary-700">{t('dedupScopeDocument')}</span>
                        </label>
                         <label className="flex items-center cursor-pointer">
                            <input type="radio" value="group" checked={dedupScope === 'group'} onChange={e => setState({ dedupScope: e.target.value as any })} className="h-4 w-4 border-secondary-300 text-primary-600 focus:ring-primary-500" />
                            <span className="ml-2 text-sm text-secondary-700">{t('dedupScopeGroup')}</span>
                        </label>
                    </div>
                    {dedupScope === 'group' && (
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-secondary-600 mb-1">{t('dedupGroupColumnLabel')}</label>
                            <select value={dedupGroupColumn} onChange={e => setState({ dedupGroupColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                {source.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    )}
                </fieldset>
                 <fieldset className="border border-secondary-200 rounded p-3">
                    <legend className="text-sm font-semibold px-1 text-secondary-600">{t('dedupCompareColumnsLabel')}</legend>
                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-secondary-50 rounded">
                        {source.headers.map(col => (
                            <div key={col} className="flex items-center">
                                <input type="checkbox" id={`compare-${col}`} value={col} checked={dedupCompareColumns.includes(col)} onChange={() => handleCompareColumnChange(col)} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"/>
                                <label htmlFor={`compare-${col}`} className="ml-2 text-sm text-secondary-700 truncate cursor-pointer">{col}</label>
                            </div>
                        ))}
                    </div>
                 </fieldset>
                 <div className="pl-1 pt-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedMatchThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerMatchThreshold}%</span></label>
                        <input type="range" min="90" max="100" value={jaroWinklerMatchThreshold} onChange={e => setState({ jaroWinklerMatchThreshold: parseInt(e.target.value, 10)})} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('unifiedReviewThreshold')}: <span className="font-bold text-primary-700">{jaroWinklerReviewThreshold}%</span></label>
                        <input type="range" min="80" max="96" value={jaroWinklerReviewThreshold} onChange={e => setState({ jaroWinklerReviewThreshold: parseInt(e.target.value, 10)})} className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                    </div>
                </div>
            </div>
        );
    };

  const renderMainContent = () => {
    const fileUploadNeeded = 
        (mode === 'merge' && dataSources.length < 2) ||
        (mode === 'deduplicate' && dataSources.length < 1) ||
        ((mode === 'visualize' || mode === 'fillGroup' || mode === 'interactiveDeduplicate') && dataSources.length < 1);

    const getFileInstruction = () => {
        switch(mode) {
            case 'merge': return t('batchNeedTwoFiles');
            case 'deduplicate':
            case 'interactiveDeduplicate':
                return t('dedupNeedOneFile');
            case 'fillGroup': return t('fillGroupNeedOneFile');
            case 'visualize': return t('visualizeNeedOneFile');
            default: return '';
        }
    };
    
    if (mode === 'visualize' && dataSources.length > 0) {
        return (
            <div className="animate-slide-in-up space-y-6">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-secondary-200 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <FileIcon className="flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="font-semibold text-secondary-800 truncate" title={dataSources[0].name}>{dataSources[0].name}</p>
                            <p className="text-xs text-secondary-500">{dataSources[0].data.length} {t('batchRows')} &bull; {dataSources[0].headers.length} {t('batchCols')}</p>
                        </div>
                    </div>
                    <button onClick={() => handleRemoveDataSource(dataSources[0].name)} className="p-1 text-secondary-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors flex-shrink-0" aria-label={t('batchRemove')}>
                        <RemoveIcon />
                    </button>
                </div>
                <div className="border-b border-secondary-200 mb-4">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button onClick={() => setVisualizeView('chart')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${visualizeView === 'chart' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                            {t('statsTabVisualization')}
                        </button>
                        <button onClick={() => setVisualizeView('dashboard')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${visualizeView === 'dashboard' ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'}`}>
                            {t('statsTabDashboard')}
                        </button>
                    </nav>
                </div>
                {visualizeView === 'chart' && (
                     <ChartConstructor 
                        data={dataSources[0].data}
                        columns={chartColumns}
                        config={{ x: chartConfigX, yCalculation: chartConfigYCalculation, yValueColumn: chartConfigYValueColumn, group: chartConfigGroup, type: chartConfigType, labelDisplay: chartConfigLabelDisplay }}
                        onConfigChange={handleChartConfigChange as any}
                        filters={{ x: chartConfigFilterX, group: chartConfigFilterGroup }}
                        onFilterChange={handleChartFilterChange}
                    />
                )}
                {visualizeView === 'dashboard' && (
                    <Dashboard
                        data={dataSources[0].data}
                        layouts={dashboardLayouts}
                        widgets={dashboardWidgets}
                        onLayoutsChange={(layouts) => setState({ dashboardLayouts: layouts })}
                        onWidgetsChange={(widgets) => setState({ dashboardWidgets: widgets })}
                        columns={chartColumns}
                    />
                )}
            </div>
        )
    }

    if (mode === 'interactiveDeduplicate' && reviewIndex > -1) {
        return (
            <InteractiveReview
                group={reviewGroups[reviewIndex]}
                currentIndex={reviewIndex}
                total={reviewGroups.length}
                onDecision={handleReviewDecision}
            />
        )
    }

    return (
        <div className="animate-slide-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-secondary-800">{t('batchDataSourcesTitle')}</h2>
                    <div 
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-1 flex justify-center items-center px-6 py-10 border-2 border-secondary-300 border-dashed rounded-lg bg-secondary-50 hover:bg-secondary-100 hover:border-primary-400 transition-colors duration-200 group cursor-pointer"
                    >
                        <input id="excelFileBatch" name="excelFileBatch" type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleFileChange} ref={fileInputRef} multiple={mode === 'merge' || mode === 'deduplicate'}/>
                        <div className="space-y-1 text-center">
                            <div className="w-12 h-12 mx-auto text-secondary-400 group-hover:text-primary-600 transition-colors"><UploadIcon /></div>
                            <div className="flex text-sm text-secondary-600 justify-center">
                                <span className="relative rounded-md font-medium text-primary-600 hover:text-primary-800 focus-within:outline-none"><span>{t('uploadFileLink')}</span></span>
                                <p className="pl-1">{t('dragAndDrop')}</p>
                            </div>
                            <p className="text-xs text-secondary-500">{ (mode === 'merge' || mode === 'deduplicate') ? t('batchUploadInstruction') : t('fillGroupNeedOneFile') }</p>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {dataSources.map(ds => (
                            <div key={ds.name} className="flex items-center justify-between p-3 bg-white rounded-lg border border-secondary-200 shadow-sm animate-slide-in-up">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileIcon className="flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-secondary-800 truncate" title={ds.name}>{ds.name}</p>
                                        <p className="text-xs text-secondary-500">{ds.data.length} {t('batchRows')} &bull; {ds.headers.length} {t('batchCols')}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleRemoveDataSource(ds.name)} className="p-1 text-secondary-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors flex-shrink-0" aria-label={t('batchRemove')}>
                                <RemoveIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-secondary-800">{t(`${mode}ConfigTitle`)}</h2>
                    {fileUploadNeeded ? (
                        <div className="flex items-center justify-center h-full p-6 bg-secondary-50 rounded-lg text-secondary-500 text-center">
                            <p>{getFileInstruction()}</p>
                        </div>
                    ) : (
                        <>
                            {mode === 'merge' && renderMergeConfig()}
                            {mode === 'deduplicate' && renderDeduplicateConfig()}
                            {mode === 'fillGroup' && renderFillGroupConfig()}
                            {mode === 'interactiveDeduplicate' && renderInteractiveDeduplicateConfig()}
                        </>
                    )}
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
                    onClick={mode === 'merge' ? handleMerge : (mode === 'deduplicate' ? handleDeduplicate : (mode === 'fillGroup' ? handleFillByGroup : handleInteractiveDeduplicate))}
                    disabled={mode === 'merge' ? isMergeButtonDisabled : (mode === 'deduplicate' ? isDeduplicateButtonDisabled : (mode === 'fillGroup' ? isFillGroupButtonDisabled : isInteractiveDeduplicateButtonDisabled))}
                    className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg"
                >
                    {isLoading ? <Loader /> : t(`${mode}ProcessButton`)}
                </button>
            </div>
        </div>
      );
  };


  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center p-1 bg-secondary-200 rounded-lg">
        <button 
            onClick={() => { handleReset(); setState({ mode: 'merge' }); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'merge' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
        >
            {t('batchModeMerge')}
        </button>
        <button 
            onClick={() => { handleReset(); setState({ mode: 'deduplicate' }); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'deduplicate' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
        >
           {t('batchModeDeduplicate')}
        </button>
        <button 
            onClick={() => { handleReset(); setState({ mode: 'interactiveDeduplicate' }); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'interactiveDeduplicate' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
        >
           {t('batchModeInteractiveDeduplicate')}
        </button>
         <button 
            onClick={() => { handleReset(); setState({ mode: 'fillGroup' }); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'fillGroup' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
        >
           {t('batchModeFillGroup')}
        </button>
        <button 
            onClick={() => { handleReset(); setState({ mode: 'visualize' }); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'visualize' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
        >
           {t('batchModeVisualize')}
        </button>
      </div>

    {renderMainContent()}
      
      {isLoading && (<div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md mb-6 animate-pulse">{t('progressStarting')}</div>)}
      {error && <ErrorMessage message={error} />}

      {processStats && mode === 'interactiveDeduplicate' && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg shadow-sm animate-slide-in-up">
            <h4 className="font-bold text-blue-800">{t('unifiedProcessSummaryTitle')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center mt-2">
                <div><span className="font-semibold text-secondary-700">{processStats.initial}</span> <span className="text-sm text-secondary-600">{t('initialItems')}</span></div>
                <div><span className="font-semibold text-green-700">{processStats.final}</span> <span className="text-sm text-secondary-600">{t('finalItems')}</span></div>
                <div><span className="font-semibold text-yellow-700">{processStats.review}</span> <span className="text-sm text-secondary-600">{t('itemsForReview')}</span></div>
            </div>
        </div>
      )}
      
      {processedData && reviewIndex === -1 && <DataTable columns={processedColumns} data={processedData} filename={`${mode}_data.xlsx`} fixedHeight />}
    </div>
  );
};

export default BatchTab;

const RemoveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const FileIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 text-primary-600 ${className}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
);
