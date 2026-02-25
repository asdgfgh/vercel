import React, { useRef, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState, initialUnpaywallState } from '../contexts/TabsStateContext';
import { checkDoiAccess } from '../services/unpaywallService';
import { UploadIcon } from './icons/UploadIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import ProgressBar from './ProgressBar';
import DataTable from './DataTable';
import { logEvent } from '../services/analyticsService';

declare const XLSX: any;

const UnpaywallTab: React.FC = () => {
    const { unpaywallState, setUnpaywallState } = useTabsState();
    const { file, fileName, headers, data, doiColumn, results, isLoading, error, progress, statusText, email } = unpaywallState;
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setState = (updates: Partial<typeof unpaywallState>) => {
        setUnpaywallState(prev => ({ ...prev, ...updates }));
    };

    const handleReset = () => {
        setState(initialUnpaywallState);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (selectedFile: File) => {
        if (!selectedFile) return;

        handleReset();
        setState({ file: selectedFile, fileName: selectedFile.name, error: null });

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length > 0) {
                    const fileHeaders = Object.keys(jsonData[0]);
                    const doiHeader = fileHeaders.find(h => h.toLowerCase().includes('doi'));
                    setState({
                        headers: fileHeaders,
                        data: jsonData,
                        doiColumn: doiHeader || fileHeaders[0] || '',
                    });
                } else {
                    setState({ error: t('apaErrorEmptyFile') });
                }
            } catch (err) {
                console.error(err);
                setState({ error: err instanceof Error ? err.message : t('apaErrorFileProcessing') });
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleProcess = useCallback(async () => {
        if (!email.trim()) {
            const errorMsg = t('unpaywallErrorEmail');
            setState({ error: errorMsg });
            logEvent('fetch_data_error', { module: 'unpaywall', error: errorMsg });
            return;
        }
        if (data.length === 0 || !doiColumn) {
            const errorMsg = t('apaErrorMissingParams');
            setState({ error: errorMsg });
            logEvent('fetch_data_error', { module: 'unpaywall', error: errorMsg });
            return;
        }

        setState({ isLoading: true, error: null, results: [] });
        logEvent('fetch_data_start', { module: 'unpaywall' });

        const resultsWithStatus: Record<string, any>[] = [];
        const totalRows = data.length;

        for (let i = 0; i < totalRows; i++) {
            const row = data[i];
            const doi = row[doiColumn];
            
            setState({
                progress: { current: i + 1, total: totalRows },
                statusText: t('unpaywallProgress', { current: i + 1, total: totalRows, doi: doi || 'N/A' })
            });
            
            const { status, pdf_url } = await checkDoiAccess(doi, email);
            resultsWithStatus.push({
                ...row,
                access_status: status,
                pdf_url: pdf_url,
            });

            // Add a polite delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setState({
            results: resultsWithStatus,
            isLoading: false,
            progress: null,
            statusText: t('progressComplete', { count: resultsWithStatus.length })
        });
        logEvent('fetch_data_success', { module: 'unpaywall', count: resultsWithStatus.length });

    }, [data, doiColumn, t, email, setState]);

    const resultColumns = useMemo(() => {
        if (results.length === 0) return [];
        const originalHeaders = headers.map(h => ({ header: h, accessor: h }));
        return [
            ...originalHeaders,
            { header: t('colAccessStatus'), accessor: 'access_status' },
            { header: t('colPdfLink'), accessor: 'pdf_url' },
        ];
    }, [results, headers, t]);
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    return (
        <div>
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <h2 className="text-xl font-bold text-secondary-800 mb-2">{t('unpaywallTab')}</h2>
                <p className="text-secondary-600">{t('unpaywallDescription')}</p>
            </div>

             <div className="mb-6">
                <label htmlFor="unpaywall-email" className="block text-sm font-medium text-secondary-600 mb-2">{t('unpaywallEmailLabel')}</label>
                <input 
                    id="unpaywall-email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setState({ email: e.target.value })} 
                    className="w-full max-w-md bg-white border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder={t('unpaywallEmailPlaceholder')}
                />
            </div>

            {!file ? (
                <div 
                    className="w-full p-8 border-2 border-dashed border-secondary-300 rounded-xl text-center cursor-pointer bg-secondary-50 hover:border-primary-500 hover:bg-secondary-100 transition-all duration-300 group"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleFileChange(e.target.files[0])} accept=".xlsx, .csv, .xls" className="hidden" />
                    <div className="mx-auto h-16 w-16 text-secondary-400 group-hover:text-primary-600 transition-colors duration-300">
                        <UploadIcon />
                    </div>
                    <p className="mt-2 font-semibold text-secondary-800">{t('apaDragOrClick')}</p>
                    <p className="text-sm text-secondary-500">{t('apaSupportedFormats')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label htmlFor="doi-column" className="block text-sm font-medium text-secondary-600 mb-2">{t('selectDoiColumnLabel')}</label>
                            <select id="doi-column" value={doiColumn} onChange={(e) => setState({ doiColumn: e.target.value })} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                     <div className="flex justify-end items-center gap-4">
                        <button onClick={handleReset} className="bg-secondary-200 text-secondary-700 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-secondary-300 flex items-center gap-2 h-12 shadow-md" aria-label={t('resetButton')}>
                            <RefreshIcon />
                            <span>{t('resetButton')}</span>
                        </button>
                        <button onClick={handleProcess} disabled={isLoading} className="w-full md:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 disabled:from-primary-300 disabled:to-primary-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center h-12 shadow-lg">
                            {isLoading ? <Loader /> : t('checkAccessButton')}
                        </button>
                    </div>
                </div>
            )}
            
            {isLoading && progress && (
                <div className="my-6">
                    <ProgressBar current={progress.current} total={progress.total} text={statusText} />
                </div>
            )}
            {!isLoading && statusText && !error && (
                <div className="my-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md">
                    {statusText}
                </div>
            )}
            {error && <div className="my-6"><ErrorMessage message={error} /></div>}

            {results.length > 0 && <DataTable columns={resultColumns as any} data={results} filename="unpaywall_results.xlsx" fixedHeight />}
        </div>
    );
};

export default UnpaywallTab;
