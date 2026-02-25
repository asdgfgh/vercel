
import React, { useCallback, useRef, useState } from 'react';
import { processIdentifier } from '../services/apaProcessingService';
import { stripHtml } from '../utils/textUtils';
import { exportArrayToXlsx } from '../utils/exportUtils';
import ErrorMessage from './ErrorMessage';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon';
import { DownloadIcon } from './icons/DownloadIcon';

import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { useTabsState, initialApaState } from '../contexts/TabsStateContext';
import { logEvent } from '../services/analyticsService';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ApaIcon } from './icons/ApaIcon';

declare const XLSX: any;

const NEW_COLUMN_VALUE = '__NEW_COLUMN__';

const vbaCode = `Sub ItalicBetweenAsterisks()

    Dim c As Range
    Dim txt As String
    Dim i As Long
    Dim startPos As Long
    Dim insideItalic As Boolean
    Dim cleanPos As Long
    
    For Each c In Selection
        
        If Not c.HasFormula And Not IsEmpty(c.Value) Then
            
            txt = c.Value
            c.Value = Replace(txt, "*", "")
            
            insideItalic = False
            cleanPos = 0
            
            For i = 1 To Len(txt)
                
                If Mid(txt, i, 1) = "*" Then
                    insideItalic = Not insideItalic
                Else
                    cleanPos = cleanPos + 1
                    If insideItalic Then
                        c.Characters(cleanPos, 1).Font.Italic = True
                    End If
                End If
                
            Next i
            
        End If
        
    Next c

End Sub`;


const ApaGeneratorTab: React.FC = () => {
    const { apaState, setApaState } = useTabsState();
    const { 
        file, fileName, headers, data, sourceColumn, targetColumn, newColumnName,
        isProcessing, progress, results, summary, error 
    } = apaState;
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useLanguage();
    const [isCopied, setIsCopied] = useState(false);

    const handleFile = useCallback((selectedFile: File) => {
        if (!selectedFile) return;
        
        if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/vnd.ms-excel'].includes(selectedFile.type)) {
            setApaState(prev => ({...prev, error: t('apaErrorInvalidFileType') }));
            return;
        }
        
        setApaState(initialApaState);
        setApaState(prev => ({ ...prev, file: selectedFile, fileName: selectedFile.name, error: null }));
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length > 0 && jsonData[0].length > 0) {
                    const fileHeaders = jsonData[0].map(String);
                    setApaState(prev => ({
                        ...prev,
                        headers: fileHeaders,
                        data: jsonData,
                        sourceColumn: fileHeaders[0] || '',
                        targetColumn: NEW_COLUMN_VALUE,
                    }));
                } else {
                    setApaState(prev => ({...prev, error: t('apaErrorEmptyFile') }));
                }
            } catch (err) {
                console.error(err);
                setApaState(prev => ({...prev, error: err instanceof Error ? err.message : t('apaErrorFileProcessing') }));
            }
        };
        reader.readAsBinaryString(selectedFile);

    }, [t, setApaState]);

    const resetState = () => {
        setApaState(initialApaState);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleProcess = async () => {
        if (!data.length || !sourceColumn || (!targetColumn && !newColumnName)) {
            const errorMsg = t('apaErrorMissingParams');
            setApaState(prev => ({...prev, error: errorMsg }));
            logEvent('fetch_data_error', { module: 'apa_generator', error: errorMsg });
            return;
        }

        setApaState(prev => ({...prev, isProcessing: true, error: null, summary: null, results: null }));
        logEvent('fetch_data_start', { module: 'apa_generator' });

        const sourceIndex = headers.indexOf(sourceColumn);
        let targetIndex = headers.indexOf(targetColumn);

        const newHeaders = [...headers];
        if (targetColumn === NEW_COLUMN_VALUE) {
            targetIndex = newHeaders.length;
            newHeaders.push(newColumnName.trim());
        }

        const processedData: any[][] = [newHeaders];
        let successCount = 0;

        const rowsToProcess = data.slice(1);
        setApaState(prev => ({...prev, progress: { current: 0, total: rowsToProcess.length } }));
        
        for (let i = 0; i < rowsToProcess.length; i++) {
            const row = rowsToProcess[i];
            const identifier = row[sourceIndex];
            const newRow = [...row];
            
            while (newRow.length < newHeaders.length) {
                newRow.push('');
            }

            if (identifier && String(identifier).trim()) {
                try {
                    const result = await processIdentifier(String(identifier));
                    newRow[targetIndex] = stripHtml(result.apaCitation);
                    successCount++;
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : t('apaErrorUnknown');
                    newRow[targetIndex] = `${t('apaErrorPrefix')}: ${errorMessage}`;
                }
            } else {
                 newRow[targetIndex] = '';
            }
            processedData.push(newRow);
            setApaState(prev => ({...prev, progress: { current: i + 1, total: rowsToProcess.length } }));
        }

        setApaState(prev => ({
            ...prev,
            results: processedData, 
            summary: { success: successCount, error: rowsToProcess.length - successCount },
            isProcessing: false 
        }));
        logEvent('fetch_data_success', { module: 'apa_generator', count: successCount });
    };

    const handleDownload = () => {
        if (results) {
             const originalName = fileName.replace(/\.(xlsx|csv)$/, '') || 'processed';
             exportArrayToXlsx(results, `${originalName}_with_citations.xlsx`);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };
    
    const handleCopyCode = useCallback(() => {
        if (isCopied) return;
        navigator.clipboard.writeText(vbaCode).then(() => {
            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy code: ", err);
        });
    }, [isCopied]);

    const renderFileUploader = () => (
        <div 
            className="w-full p-8 border-2 border-dashed border-secondary-300 rounded-xl text-center cursor-pointer bg-secondary-50 hover:border-primary-500 hover:bg-secondary-100 transition-all duration-300 group"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleFile(e.target.files[0])} accept=".xlsx, .csv, .xls" className="hidden" />
            <div className="mx-auto h-16 w-16 text-secondary-400 group-hover:text-primary-600 transition-colors duration-300">
                <UploadIcon />
            </div>
            <p className="mt-2 font-semibold text-secondary-800">{t('apaDragOrClick')}</p>
            <p className="text-sm text-secondary-500">{t('apaSupportedFormats')}</p>
        </div>
    );

    const renderConfiguration = () => (
        <div className="w-full max-w-2xl mx-auto space-y-6 p-6 bg-white rounded-xl shadow-lg border border-secondary-200">
            <div>
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-10 w-10 text-primary-600 flex-shrink-0"><FileIcon /></div>
                    <div>
                        <h3 className="text-lg font-bold text-secondary-900">{t('apaConfigTitle')}</h3>
                        <p className="text-sm text-secondary-500 truncate max-w-xs">{fileName}</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="source-column" className="block text-sm font-medium text-secondary-600 mb-2">{t('apaSourceColumnLabel')}</label>
                        <select id="source-column" value={sourceColumn} onChange={(e) => setApaState(prev => ({...prev, sourceColumn: e.target.value }))} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="target-column" className="block text-sm font-medium text-secondary-600 mb-2">{t('apaTargetColumnLabel')}</label>
                        <select id="target-column" value={targetColumn} onChange={(e) => setApaState(prev => ({...prev, targetColumn: e.target.value }))} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400">
                            <option value={NEW_COLUMN_VALUE}>{t('apaAddNewColumn')}</option>
                            {headers.map(h => <option key={h} value={h}>{t('apaReplaceData', { column: h })}</option>)}
                        </select>
                    </div>
                    {targetColumn === NEW_COLUMN_VALUE && (
                        <div>
                            <label htmlFor="new-column-name" className="block text-sm font-medium text-secondary-600 mb-2">{t('apaNewColumnNameLabel')}</label>
                            <input id="new-column-name" type="text" value={newColumnName} onChange={(e) => setApaState(prev => ({...prev, newColumnName: e.target.value }))} className="w-full p-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400" />
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4 pt-4">
                <button onClick={handleProcess} className="w-full flex-1 py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 shadow-lg">
                    {t('apaStartProcessingButton')}
                </button>
                 <button onClick={resetState} className="py-3 px-4 bg-secondary-200 text-secondary-700 font-semibold rounded-lg hover:bg-secondary-300 transition-colors flex items-center justify-center gap-2">
                    <RefreshIcon />
                    <span>{t('resetButton')}</span>
                </button>
            </div>
        </div>
    );
    
    const renderProgress = () => (
         <div className="w-full max-w-2xl mx-auto text-center p-8 bg-white rounded-xl shadow-lg border border-secondary-200">
            <h3 className="text-xl font-bold text-secondary-900 mb-4">{t('apaProcessingTitle')}</h3>
            <div className="w-full bg-secondary-200 rounded-full h-4 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-400 to-primary-600 h-4 rounded-full transition-all duration-300 animate-pulse" style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}></div>
            </div>
            <p className="mt-4 text-sm text-secondary-500">{t('apaProgressText', { current: progress.current, total: progress.total })}</p>
        </div>
    );

    const renderResults = () => (
        <div className="animate-slide-in-up">
            <div className="w-full p-6 bg-white rounded-xl shadow-lg text-center border border-secondary-200">
                 <h3 className="text-2xl font-bold text-secondary-900">{t('apaResultsTitle')}</h3>
                 {summary && (
                     <p className="text-secondary-600 my-4">
                        <span className="text-green-600 font-semibold">{t('apaSuccessCount')}: {summary.success}</span> | <span className="text-red-600 font-semibold">{t('apaErrorCount')}: {summary.error}</span>
                    </p>
                 )}
                 <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                     <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 shadow-lg">
                        <DownloadIcon />
                        {t('apaDownloadButton')}
                    </button>
                    <button onClick={resetState} className="w-full sm:w-auto py-3 px-6 bg-secondary-200 text-secondary-700 font-semibold rounded-lg hover:bg-secondary-300 transition-colors flex items-center justify-center gap-2">
                        <RefreshIcon />
                        <span>{t('resetButton')}</span>
                    </button>
                 </div>
            </div>
             <div className="mt-8 p-6 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg space-y-4">
                <h4 className="text-lg font-bold text-amber-900">{t('apaExcelItalicTitle')}</h4>
                <ol className="list-decimal list-inside space-y-3 text-secondary-700 text-sm">
                    <li>{t('apaExcelItalicStep1')}</li>
                    <li>{t('apaExcelItalicStep2')}</li>
                    <li>
                        {t('apaExcelItalicStep3')}
                        <div className="relative group">
                            <pre className="bg-secondary-800 text-white p-3 pr-12 rounded-md mt-2 text-xs overflow-x-auto font-mono">
                                <code>
                                    {vbaCode}
                                </code>
                            </pre>
                             <button
                                onClick={handleCopyCode}
                                className="absolute top-2 right-2 p-1.5 bg-secondary-700 hover:bg-secondary-600 rounded-lg text-secondary-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary-800 focus:ring-primary-500"
                                aria-label={isCopied ? t('apaCopied') : t('apaCopyCode')}
                            >
                                {isCopied ? (
                                    <CheckIcon className="h-4 w-4 text-green-400" />
                                ) : (
                                    <CopyIcon className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </li>
                    <li>{t('apaExcelItalicStep4')}</li>
                    <li>{t('apaExcelItalicStep5')}</li>
                </ol>
            </div>
        </div>
    );

    return (
        <div className="w-full">
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg mb-8 shadow-md">
                <div className="flex items-center gap-4 mb-2">
                    <ApaIcon className="h-8 w-8 text-primary-600" />
                    <h2 className="text-xl font-bold text-secondary-800">{t('apaGeneratorTab')}</h2>
                </div>
                <p className="text-secondary-600">{t('apaGeneratorDescription')}</p>
            </div>
            
            <div className="w-full flex justify-center">
                <div className="w-full max-w-2xl">
                    {!file && renderFileUploader()}
                    {file && !isProcessing && !results && renderConfiguration()}
                    {isProcessing && progress && renderProgress()}
                    {results && renderResults()}
                    {error && <div className="mt-6"><ErrorMessage message={error} /></div>}
                </div>
            </div>
        </div>
    );
};

export default ApaGeneratorTab;
