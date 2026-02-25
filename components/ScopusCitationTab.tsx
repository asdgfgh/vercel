
import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState, initialScopusCitationState } from '../contexts/TabsStateContext';
import { getCitationsByYearRange } from '../services/scopusService';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import ProgressBar from './ProgressBar';
import DataTable from './DataTable';
import { RefreshIcon } from './icons/RefreshIcon';
import { ScopusCitationIcon } from './icons/ScopusCitationIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { UploadIcon } from './icons/UploadIcon';

declare const XLSX: any;
const NEW_COLUMN_VALUE = '__NEW__';

const ScopusCitationTab: React.FC = () => {
    const { scopusCitationState, setScopusCitationState } = useTabsState();
    const { 
        apiKey, authorId, startYear, endYear, isLoading, error, statusText, 
        totalCitations, processedPublications, hIndex, results, chartColumns, apiLog,
        mode, file, fileName, headers, originalData, processedData,
        sourceColumn, totalCitationsColumn, hIndexColumn, writeMode,
        newColNameTotal, newColNameHIndex
    } = scopusCitationState;
    
    const { t } = useLanguage();
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setState = (updates: Partial<typeof scopusCitationState>) => {
        setScopusCitationState(prev => ({ ...prev, ...updates }));
    };

    const handleReset = () => {
        const currentMode = mode;
        const currentApiKey = apiKey;
        setState({ ...initialScopusCitationState, apiKey: currentApiKey, mode: currentMode });
        setProgress(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCalculate = async () => {
        if (!apiKey) { setState({ error: t('errorApiKeyRequired') }); return; }
        if (!authorId.trim()) { setState({ error: t('errorNoAuthorIds') }); return; }
        
        const sYear = parseInt(startYear);
        const eYear = parseInt(endYear);

        if (isNaN(sYear) || isNaN(eYear) || sYear > eYear) {
            setState({ error: t('apaErrorMissingParams') });
            return;
        }

        setState({ isLoading: true, error: null, results: [], totalCitations: 0, processedPublications: 0, apiLog: [], hIndex: null });
        logEvent('fetch_data_start', { module: 'scopus_citation', mode: 'single' });
        setProgress({ current: 0, total: 0 });

        try {
            const { data, totalProcessed, apiLog, hIndex } = await getCitationsByYearRange(
                authorId.trim(), sYear, eYear, apiKey,
                (current, total) => {
                    setProgress({ current, total });
                    setState({ statusText: t('scopusCitationProgressProcessing', { current, total }) });
                }
            );

            const total = data.reduce((sum, item) => sum + item.citations, 0);
            
            setState({
                results: data, totalCitations: total, processedPublications: totalProcessed, hIndex,
                chartColumns: [{ accessor: 'year', header: t('colYear') }, { accessor: 'citations', header: t('colCitationsCount') }],
                statusText: t('progressComplete', { count: data.length }), apiLog,
            });
            logEvent('fetch_data_success', { module: 'scopus_citation', mode: 'single', count: data.length });

        } catch (err: any) {
            setState({ error: `${t('errorFetchFailed')}: ${err.message}` });
            logEvent('fetch_data_error', { module: 'scopus_citation', mode: 'single', error: err.message });
        } finally {
            setState({ isLoading: false });
            setProgress(null);
        }
    };

    const handleProcessFile = async () => {
        if (!apiKey) { setState({ error: t('errorApiKeyRequired') }); return; }
        if (!file || !sourceColumn || !totalCitationsColumn || !hIndexColumn) {
            const errorMsg = t('scopusCitationErrorConfig');
            setState({ error: errorMsg });
            logEvent('fetch_data_error', { module: 'scopus_citation', mode: 'file', error: errorMsg });
            return;
        }
        
        const sYear = parseInt(startYear);
        const eYear = parseInt(endYear);
        if (isNaN(sYear) || isNaN(eYear) || sYear > eYear) {
            setState({ error: t('apaErrorMissingParams') });
            return;
        }

        setState({ isLoading: true, error: null, processedData: null });
        logEvent('fetch_data_start', { module: 'scopus_citation', mode: 'file' });
        
        const dataToProcess = [...originalData];
        const totalRows = dataToProcess.length;

        for (let i = 0; i < totalRows; i++) {
            const row = dataToProcess[i];
            const authorId = row[sourceColumn];

            setState({ statusText: t('progressProcessingAuthor', { current: i + 1, total: totalRows, author: authorId || `Row ${i+1}`}) });
            setProgress({ current: i + 1, total: totalRows });

            if (!authorId || !String(authorId).trim()) continue;

            const targetColTotal = totalCitationsColumn === NEW_COLUMN_VALUE ? newColNameTotal : totalCitationsColumn;
            const targetColHIndex = hIndexColumn === NEW_COLUMN_VALUE ? newColNameHIndex : hIndexColumn;

            const shouldProcessTotal = writeMode === 'overwrite' || (writeMode === 'fillEmpty' && (row[targetColTotal] === undefined || String(row[targetColTotal]).trim() === ''));
            const shouldProcessHIndex = writeMode === 'overwrite' || (writeMode === 'fillEmpty' && (row[targetColHIndex] === undefined || String(row[targetColHIndex]).trim() === ''));

            if (!shouldProcessTotal && !shouldProcessHIndex) continue;

            try {
                const { data, hIndex } = await getCitationsByYearRange(
                    String(authorId).trim(), sYear, eYear, apiKey,
                    () => {} // No inner progress needed here
                );
                
                if (shouldProcessTotal) {
                    const total = data.reduce((sum, item) => sum + item.citations, 0);
                    row[targetColTotal] = total;
                }

                if (shouldProcessHIndex) {
                    row[targetColHIndex] = hIndex;
                }
            } catch (err: any) {
                console.warn(`Failed to process author ID ${authorId}: ${err.message}`);
                const errorMessage = `ERROR: ${err.message}`;
                if(shouldProcessTotal) row[targetColTotal] = errorMessage;
                if(shouldProcessHIndex) row[targetColHIndex] = errorMessage;
            }

            await new Promise(r => setTimeout(r, 200)); // Politeness delay
        }

        setState({
            isLoading: false,
            processedData: dataToProcess,
            statusText: t('progressComplete', { count: totalRows })
        });
        logEvent('fetch_data_success', { module: 'scopus_citation', mode: 'file', count: totalRows });
    };

    const handleExport = () => {
        if (results.length === 0) return;
        exportObjectsToXlsx(results, `citations_${authorId}_${startYear}-${endYear}.xlsx`);
    };

    const handleExportApiLog = () => {
        if (apiLog.length === 0) return;
        const logContent = JSON.stringify(apiLog, null, 2);
        const blob = new Blob([logContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'scopus_citation_api_log.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleReset();
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = event.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    const fileHeaders = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
                    setState({
                        file: selectedFile, fileName: selectedFile.name, originalData: jsonData, headers: fileHeaders,
                        sourceColumn: fileHeaders.find(h => h.toUpperCase().includes('SCOPUS')) || fileHeaders[0] || ''
                    });
                } catch (err: any) {
                    setState({ error: err.message });
                }
            };
            reader.readAsBinaryString(selectedFile);
        }
    };
    
    const handleDownloadResult = () => {
        if (!processedData) return;
        exportObjectsToXlsx(processedData, `processed_${fileName}`);
    };

    const renderSingleAuthorMode = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="authorIdCitation" className="block text-sm font-medium text-secondary-600 mb-2">{t('colAuthorScopusId')}</label>
                    <input id="authorIdCitation" type="text" value={authorId} onChange={(e) => setState({ authorId: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder="57211831518" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startYearCitation" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
                        <input id="startYearCitation" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder="2018" />
                    </div>
                    <div>
                        <label htmlFor="endYearCitation" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
                        <input id="endYearCitation" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" placeholder="2023" />
                    </div>
                </div>
            </div>
             <div className="flex justify-end items-center gap-4 mb-6">
                <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-secondary-300 flex items-center gap-2 h-12 shadow-md"><RefreshIcon /><span>{t('resetButton')}</span></button>
                <button onClick={handleCalculate} disabled={isLoading} className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg">
                    {isLoading ? <Loader /> : t('scopusCitationCalculateButton')}
                </button>
            </div>
             {(!isLoading && (apiLog.length > 0 || results.length > 0)) && (
                <div className="animate-slide-in-up space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-6 bg-white rounded-xl border border-secondary-200 shadow-lg flex flex-col items-center justify-center"><p className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">{t('scopusCitationTotal')}</p><p className="text-4xl font-extrabold text-primary-600 mt-2">{totalCitations.toLocaleString()}</p></div>
                        <div className="p-6 bg-white rounded-xl border border-secondary-200 shadow-lg flex flex-col items-center justify-center"><p className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">{t('scopusCitationProcessed')}</p><p className="text-4xl font-extrabold text-secondary-800 mt-2">{processedPublications}</p></div>
                        <div className="p-6 bg-white rounded-xl border border-secondary-200 shadow-lg flex flex-col items-center justify-center"><p className="text-sm font-semibold text-secondary-500 uppercase tracking-wider">{t('colHIndex')}</p><p className="text-4xl font-extrabold text-green-600 mt-2">{hIndex ?? 'N/A'}</p></div>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button onClick={handleExportApiLog} disabled={apiLog.length === 0} className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 shadow-md disabled:opacity-50"><DownloadIcon />{t('scopusCitationExportApiLog')}</button>
                        <button onClick={handleExport} disabled={results.length === 0} className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:shadow-xl hover:-translate-y-0.5 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 shadow-md disabled:opacity-50"><DownloadIcon />{t('scopusCitationExport')}</button>
                    </div>
                    {results.length > 0 && <DataTable columns={chartColumns as any} data={results} filename={`citations_${authorId}.xlsx`} />}
                </div>
            )}
        </>
    );

    const renderFileMode = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startYearFile" className="block text-sm font-medium text-secondary-600 mb-2">{t('fromYearLabel')}</label>
                        <input id="startYearFile" type="number" value={startYear} onChange={(e) => setState({ startYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="2018" />
                    </div>
                    <div>
                        <label htmlFor="endYearFile" className="block text-sm font-medium text-secondary-600 mb-2">{t('toYearLabel')}</label>
                        <input id="endYearFile" type="number" value={endYear} onChange={(e) => setState({ endYear: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="2023" />
                    </div>
                </div>
            </div>
            
            {!file ? (
                 <div onClick={() => fileInputRef.current?.click()} className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-secondary-300 border-dashed rounded-lg h-full bg-secondary-50 hover:bg-secondary-100 cursor-pointer">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
                    <div className="space-y-1 text-center">
                        <div className="w-12 h-12 mx-auto text-secondary-400"><UploadIcon /></div>
                        <div className="flex text-sm text-secondary-600 justify-center">
                            <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-800">
                                <span>{t('uploadFileLink')}</span>
                            </label>
                            <p className="pl-1">{t('dragAndDrop')}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-slide-in-up">
                    <div className="p-6 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-secondary-600 mb-1">{t('scopusCitationSelectSource')}</label>
                            <select value={sourceColumn} onChange={e => setState({ sourceColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('scopusCitationSelectTotalCol')}</label>
                                <select value={totalCitationsColumn} onChange={e => setState({ totalCitationsColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                    <option value={NEW_COLUMN_VALUE}>{t('scopusCitationAddNewColumn')}</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                {totalCitationsColumn === NEW_COLUMN_VALUE && <input type="text" value={newColNameTotal} onChange={e => setState({ newColNameTotal: e.target.value })} placeholder={t('scopusCitationNewColNameTotal')} className="w-full mt-2 p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('scopusCitationSelectHIndexCol')}</label>
                                <select value={hIndexColumn} onChange={e => setState({ hIndexColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                    <option value={NEW_COLUMN_VALUE}>{t('scopusCitationAddNewColumn')}</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                {hIndexColumn === NEW_COLUMN_VALUE && <input type="text" value={newColNameHIndex} onChange={e => setState({ newColNameHIndex: e.target.value })} placeholder={t('scopusCitationNewColNameHIndex')} className="w-full mt-2 p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-secondary-600 mb-2">{t('scopusCitationWriteMode')}</label>
                            <div className="flex gap-4 p-2 bg-secondary-100 rounded-lg">
                                <label className="flex items-center flex-1 cursor-pointer">
                                    <input type="radio" value="overwrite" checked={writeMode === 'overwrite'} onChange={e => setState({ writeMode: e.target.value as 'overwrite' | 'fillEmpty' })} className="hidden peer"/>
                                    <span className="w-full text-center py-2 px-4 rounded-md text-sm font-semibold transition-all peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('scopusCitationOverwrite')}</span>
                                </label>
                                <label className="flex items-center flex-1 cursor-pointer">
                                    <input type="radio" value="fillEmpty" checked={writeMode === 'fillEmpty'} onChange={e => setState({ writeMode: e.target.value as 'overwrite' | 'fillEmpty' })} className="hidden peer"/>
                                    <span className="w-full text-center py-2 px-4 rounded-md text-sm font-semibold transition-all peer-checked:bg-white peer-checked:text-primary-700 peer-checked:shadow">{t('scopusCitationFillEmpty')}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end items-center gap-4 mb-6">
                        <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg flex items-center gap-2"><RefreshIcon /><span>{t('resetButton')}</span></button>
                        <button onClick={handleProcessFile} disabled={isLoading} className="bg-primary-500 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2">{isLoading ? <Loader /> : t('scopusCitationProcessFile')}</button>
                    </div>
                </div>
            )}
             {processedData && (
                <div className="flex justify-end mt-4"><button onClick={handleDownloadResult} className="inline-flex items-center gap-2 bg-green-500 text-white font-bold py-2 px-4 rounded-lg"><DownloadIcon />{t('scopusCitationDownloadResult')}</button></div>
            )}
        </>
    );

    return (
        <div>
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <div className="flex items-center gap-4 mb-2"><ScopusCitationIcon className="h-8 w-8 text-primary-600" /><h2 className="text-xl font-bold text-secondary-800">{t('scopusCitationTitle')}</h2></div>
                <p className="text-secondary-600">{t('scopusCitationDesc')}</p>
            </div>
            
            <div className="mb-6 flex justify-center p-1 bg-secondary-200 rounded-lg max-w-sm mx-auto">
                <button onClick={() => setState({ mode: 'single' })} className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'single' ? 'bg-white text-primary-700 shadow' : 'text-secondary-600'}`}>{t('scopusCitationModeSingle')}</button>
                <button onClick={() => setState({ mode: 'file' })} className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'file' ? 'bg-white text-primary-700 shadow' : 'text-secondary-600'}`}>{t('scopusCitationModeFile')}</button>
            </div>

            <div className="md:col-span-2 mb-6">
                <label htmlFor="apiKeyScopusCitation" className="block text-sm font-medium text-secondary-600 mb-2">{t('apiKeyLabel')}</label>
                <input id="apiKeyScopusCitation" type="password" value={apiKey} onChange={(e) => setState({ apiKey: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={t('apiKeyPlaceholder')} />
            </div>

            {mode === 'single' ? renderSingleAuthorMode() : renderFileMode()}

            {error && <div className="mt-6"><ErrorMessage message={error} /></div>}
            
            {isLoading && (<div className="my-6 animate-slide-in-up"><ProgressBar current={progress?.current || 0} total={progress?.total || 100} text={statusText || t('progressStarting')} /></div>)}
            {!isLoading && statusText && !error && (<div className="my-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md">{statusText}</div>)}
        </div>
    );
};

export default ScopusCitationTab;
