import React, { useState, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTabsState } from '../contexts/TabsStateContext';
import ChartConstructor from './ChartConstructor';
import { ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DownloadIcon } from './icons/DownloadIcon';
import { exportObjectsToXlsx } from '../utils/exportUtils';

declare const htmlToImage: any;

const COLORS = [ '#ca8a04', '#1e293b', '#64748b', '#a16207', '#ef4444' ];

const RemoveIcon: React.FC<{ onClick: () => void, className?: string, title?: string }> = ({ onClick, className, title }) => (
    <button onClick={onClick} title={title} className={`text-secondary-400 hover:text-red-600 transition-colors ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    </button>
);

const SummaryChart = ({ data, categoryKey, valueKey, growthKey, mainValueType, onMainValueTypeChange, barSize }: { 
    data: any[], 
    categoryKey: string, 
    valueKey: string, 
    growthKey: string,
    mainValueType: 'bar' | 'line',
    onMainValueTypeChange: (type: 'bar' | 'line') => void,
    barSize: number
}) => {
    const { t } = useLanguage();
    const chartRef = useRef(null);

    const chartData = useMemo(() => {
        return data.map(row => ({
            [categoryKey]: row.category,
            [valueKey]: parseFloat(String(row.value).replace(',', '.')) || 0,
            [growthKey]: parseFloat(String(row.growth)) || 0,
        })).filter(d => d[valueKey] > 0 || d[growthKey] !== 0);
    }, [data, categoryKey, valueKey, growthKey]);
    
    const handleDownloadPng = async () => {
        if (!chartRef.current) return;
        try {
            const dataUrl = await htmlToImage.toPng(chartRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = 'summary-chart.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download chart:', error);
        }
    };
    
    const handleExportXlsx = () => {
        if (chartData.length > 0) {
            exportObjectsToXlsx(chartData, 'summary_chart_data.xlsx');
        }
    };

    if (chartData.length === 0) return null;

    return (
        <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm">
            <div className="flex justify-end mb-2">
                <div className="flex items-center bg-secondary-100 rounded-lg p-1 text-sm">
                     <button
                        onClick={() => onMainValueTypeChange('bar')}
                        className={`px-3 py-1 rounded-md transition-colors ${mainValueType === 'bar' ? 'bg-white shadow text-primary-700 font-semibold' : 'text-secondary-600 hover:bg-secondary-200'}`}
                    >
                        {t('barChart')}
                    </button>
                    <button
                        onClick={() => onMainValueTypeChange('line')}
                        className={`px-3 py-1 rounded-md transition-colors ${mainValueType === 'line' ? 'bg-white shadow text-primary-700 font-semibold' : 'text-secondary-600 hover:bg-secondary-200'}`}
                    >
                        {t('lineChart')}
                    </button>
                </div>
            </div>
            <div ref={chartRef} className="w-full h-96 bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey={categoryKey} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
                        <Tooltip />
                        <Legend />
                        {mainValueType === 'bar' ? (
                            <Bar yAxisId="left" dataKey={valueKey} fill={COLORS[0]} name={valueKey} maxBarSize={barSize} />
                        ) : (
                            <Line yAxisId="left" type="monotone" dataKey={valueKey} stroke={COLORS[0]} strokeWidth={2} name={valueKey} />
                        )}
                        <Line yAxisId="right" type="monotone" dataKey={growthKey} stroke={COLORS[1]} strokeWidth={2} name={growthKey} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
             <div className="flex justify-end items-center gap-4 mt-4">
                <button onClick={handleDownloadPng} className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 shadow-md">
                    <DownloadIcon /><span>{t('downloadPNG')}</span>
                </button>
                <button onClick={handleExportXlsx} className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 shadow-md">
                    <DownloadIcon /><span>{t('downloadXLSX')}</span>
                </button>
            </div>
        </div>
    );
};


const ManualVisualizerTab: React.FC = () => {
    const { manualVisualizerState, setManualVisualizerState } = useTabsState();
    const { 
        mode,
        columns, data, 
        summaryCategoryColumn, summaryValueColumn, summaryGrowthColumn, summaryData,
        summaryMainValueType, summaryBarSize,
        chartColumns, chartConfigX, chartConfigYCalculation, chartConfigYValueColumn, chartConfigGroup, chartConfigType, chartConfigFilterX, chartConfigFilterGroup,
        chartConfigLabelDisplay
    } = manualVisualizerState;
    
    const { t } = useLanguage();
    const [newColumnName, setNewColumnName] = useState('');

    const setState = (updates: Partial<typeof manualVisualizerState>) => {
        setManualVisualizerState(prev => ({ ...prev, ...updates }));
    };

    // --- Chart Config and Data Prep ---
    useEffect(() => {
        if (mode === 'raw') {
            const newChartColumns = columns.map(c => ({ accessor: c.id, header: c.name }));
            setState({ chartColumns: newChartColumns });
        }
    }, [columns, mode]);

    useEffect(() => {
        if (mode === 'raw') {
             setState({
                chartConfigX: columns[0]?.id || '',
                chartConfigYCalculation: 'count',
                chartConfigYValueColumn: '',
                chartConfigGroup: 'none',
            });
        }
    }, [mode, columns]);
    
    const chartDataForRender = useMemo(() => {
        return data;
    }, [data]);

    // --- RAW MODE ---
    const handleAddColumn = () => {
        if (!newColumnName.trim()) return;
        const newColId = `col${Date.now()}`;
        const newColumns = [...columns, { id: newColId, name: newColumnName.trim() }];
        const newData = data.map(row => ({ ...row, [newColId]: '' }));
        setState({ columns: newColumns, data: newData });
        setNewColumnName('');
    };
    const handleRemoveColumn = (colIdToRemove: string) => {
        const newColumns = columns.filter(col => col.id !== colIdToRemove);
        const newData = data.map(row => {
            const newRow = { ...row };
            delete newRow[colIdToRemove];
            return newRow;
        });
        
        let newChartConfigX = chartConfigX;
        let newChartConfigGroup = chartConfigGroup;
        if (chartConfigX === colIdToRemove) newChartConfigX = newColumns[0]?.id || '';
        if (chartConfigGroup === colIdToRemove) newChartConfigGroup = 'none';
        
        setState({ columns: newColumns, data: newData, chartConfigX: newChartConfigX, chartConfigGroup: newChartConfigGroup });
    };
    const handleAddRow = () => {
        const newRow = columns.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {});
        setState({ data: [...data, newRow] });
    };
    const handleRemoveRow = (rowIndex: number) => {
        const newData = data.filter((_, index) => index !== rowIndex);
        setState({ data: newData });
    };
    const handleCellChange = (rowIndex: number, colId: string, value: string) => {
        const newData = [...data];
        newData[rowIndex] = { ...newData[rowIndex], [colId]: value };
        setState({ data: newData });
    };

    // --- SUMMARY MODE ---
    const handleAddSummaryRow = () => {
        setState({ summaryData: [...summaryData, { id: `row${Date.now()}`, category: '', value: '', growth: '' }] });
    };
    const handleRemoveSummaryRow = (id: string) => {
        setState({ summaryData: summaryData.filter(row => row.id !== id) });
    };
    const handleSummaryCellChange = (id: string, field: 'category' | 'value' | 'growth', value: string) => {
        const newData = summaryData.map(row => row.id === id ? { ...row, [field]: value } : row);
        setState({ summaryData: newData });
    };

    const handleCalculateGrowth = () => {
        logEvent('calculate_growth_start', { module: 'manual_visualizer' });
        const newData = [...summaryData];
        if(newData.length === 0) return;

        // Note: This assumes data is already in chronological order.
        for (let i = 0; i < newData.length; i++) {
            if (i === 0) {
                newData[i].growth = t('baseYear');
            } else {
                const prevValue = parseFloat(String(newData[i-1].value).replace(',', '.'));
                const currentValue = parseFloat(String(newData[i].value).replace(',', '.'));
                if (!isNaN(prevValue) && !isNaN(currentValue) && prevValue !== 0) {
                    const growth = ((currentValue - prevValue) / prevValue) * 100;
                    newData[i].growth = `${growth.toFixed(1)}%`;
                } else {
                    newData[i].growth = '';
                }
            }
        }
        setState({ summaryData: newData });
        logEvent('calculate_growth_success', { module: 'manual_visualizer', count: newData.length });
    };
    
    // --- Chart Config Handlers ---
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
    
    const handleMainValueTypeChange = (type: 'bar' | 'line') => {
        setState({ summaryMainValueType: type });
    };


    const renderRawMode = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddColumn()}
                    placeholder={t('manualVizColumnNamePlaceholder')}
                    className="flex-grow bg-white border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button onClick={handleAddColumn} className="bg-primary-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors">
                    {t('manualVizAddColumn')}
                </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-secondary-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-secondary-200">
                    <thead className="bg-secondary-50">
                        <tr>
                            {columns.map(col => (
                                <th key={col.id} scope="col" className="px-4 py-3 text-left text-sm font-semibold text-secondary-700 uppercase tracking-wider group">
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{col.name}</span>
                                        <RemoveIcon onClick={() => handleRemoveColumn(col.id)} className="opacity-0 group-hover:opacity-100" title={t('manualVizRemoveColumn')} />
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="relative px-4 py-3 w-12"><span className="sr-only">Remove</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200">
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-primary-50/50 transition-colors">
                                {columns.map(col => (
                                    <td key={col.id} className="px-2 py-1 whitespace-nowrap">
                                        <input
                                            type="text"
                                            value={row[col.id] || ''}
                                            onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)}
                                            className="w-full bg-transparent border border-transparent text-secondary-800 focus:bg-white focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-md px-2 py-1"
                                        />
                                    </td>
                                ))}
                                <td className="px-2 py-1 text-center">
                                    <RemoveIcon onClick={() => handleRemoveRow(rowIndex)} title={t('manualVizRemoveRow')} className="mx-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <button onClick={handleAddRow} className="w-full bg-secondary-200 text-secondary-700 font-bold py-2 px-4 rounded-lg hover:bg-secondary-300 transition-colors">
                {t('manualVizAddRow')}
            </button>
        </div>
    );
    
    const renderSummaryMode = () => (
         <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-secondary-200 shadow-sm space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('manualVizCategoryCol')}</label>
                        <input type="text" value={summaryCategoryColumn} onChange={e => setState({ summaryCategoryColumn: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('manualVizValueCol')}</label>
                        <input type="text" value={summaryValueColumn} onChange={e => setState({ summaryValueColumn: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('manualVizGrowthCol')}</label>
                        <input type="text" value={summaryGrowthColumn} onChange={e => setState({ summaryGrowthColumn: e.target.value })} className="w-full bg-secondary-50 border border-secondary-300 rounded-lg px-4 py-2 text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                    </div>
                 </div>
                  {summaryMainValueType === 'bar' && (
                    <div>
                        <label className="block text-sm font-medium text-secondary-600 mb-1">{t('manualVizBarWidth')}</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" 
                                min="10" 
                                max="200" 
                                value={summaryBarSize} 
                                onChange={e => setState({ summaryBarSize: parseInt(e.target.value, 10) })}
                                className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                            <span className="text-sm font-semibold text-primary-700 w-12 text-center">{summaryBarSize}</span>
                        </div>
                    </div>
                 )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-secondary-200 shadow-sm bg-white">
                <div className="p-4 border-b flex justify-between items-center">
                    <h4 className="text-lg font-bold text-secondary-800">{t('manualVizDataDistribution')}</h4>
                    <button onClick={handleCalculateGrowth} title={t('manualVizCalculateGrowthTooltip')} className="bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-lg hover:bg-blue-200 transition-colors text-sm">
                        {t('manualVizCalculateGrowth')}
                    </button>
                </div>
                <table className="min-w-full divide-y divide-secondary-200">
                    <thead className="bg-secondary-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-secondary-700 uppercase tracking-wider">{summaryCategoryColumn || t('manualVizCategoryCol')}</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-secondary-700 uppercase tracking-wider">{summaryValueColumn || t('manualVizValueCol')}</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-secondary-700 uppercase tracking-wider">{summaryGrowthColumn || t('manualVizGrowthCol')}</th>
                            <th scope="col" className="relative px-4 py-3 w-12"><span className="sr-only">Remove</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200">
                        {summaryData.map((row) => (
                            <tr key={row.id} className="hover:bg-primary-50/50 transition-colors">
                                <td className="px-2 py-1 whitespace-nowrap">
                                     <input type="text" value={row.category} onChange={(e) => handleSummaryCellChange(row.id, 'category', e.target.value)} className="w-full bg-transparent border border-transparent text-secondary-800 focus:bg-white focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-md px-2 py-1"/>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap">
                                     <input type="text" value={row.value} onChange={(e) => handleSummaryCellChange(row.id, 'value', e.target.value)} className="w-full bg-transparent border border-transparent text-secondary-800 focus:bg-white focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-md px-2 py-1"/>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap">
                                     <input type="text" value={row.growth} onChange={(e) => handleSummaryCellChange(row.id, 'growth', e.target.value)} className="w-full bg-transparent border border-transparent text-secondary-800 focus:bg-white focus:border-primary-400 focus:ring-1 focus:ring-primary-400 rounded-md px-2 py-1"/>
                                </td>
                                <td className="px-2 py-1 text-center">
                                    <RemoveIcon onClick={() => handleRemoveSummaryRow(row.id)} title={t('manualVizRemoveRow')} className="mx-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <button onClick={handleAddSummaryRow} className="w-full bg-secondary-200 text-secondary-700 font-bold py-2 px-4 rounded-lg hover:bg-secondary-300 transition-colors">
                {t('manualVizAddRow')}
            </button>
        </div>
    );

    return (
        <div className="space-y-8 animate-slide-in-up">
            <div className="bg-secondary-50 border-l-4 border-primary-500 p-6 rounded-r-lg shadow-md">
                <h2 className="text-xl font-bold text-secondary-800 mb-2">{t('manualVizTitle')}</h2>
                <p className="text-secondary-600">{t('manualVizDesc')}</p>
            </div>
            
            <div className="mb-6 flex justify-center p-1 bg-secondary-200 rounded-lg max-w-sm mx-auto">
                <button 
                    onClick={() => setState({ mode: 'raw' })}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'raw' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
                >
                    {t('manualVizModeRaw')}
                </button>
                <button 
                    onClick={() => setState({ mode: 'summary' })}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-300 ${mode === 'summary' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-secondary-600'}`}
                >
                {t('manualVizModeSummary')}
                </button>
            </div>

            {mode === 'raw' ? renderRawMode() : renderSummaryMode()}
            
            {mode === 'summary' ? (
                 <SummaryChart 
                    data={summaryData} 
                    categoryKey={summaryCategoryColumn} 
                    valueKey={summaryValueColumn}
                    growthKey={summaryGrowthColumn}
                    mainValueType={summaryMainValueType}
                    onMainValueTypeChange={handleMainValueTypeChange}
                    barSize={summaryBarSize}
                />
            ) : (
                (data.length > 0 && columns.length > 0) && (
                    <ChartConstructor 
                        data={chartDataForRender}
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
                )
            )}
        </div>
    );
};

export default ManualVisualizerTab;