
import React, { useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import * as htmlToImage from 'html-to-image';
import { ResponsiveContainer, BarChart, LineChart, PieChart, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line, Pie, Cell, LabelList, Area } from 'recharts';
import { DownloadIcon } from './icons/DownloadIcon';
import Loader from './Loader';
import { exportObjectsToXlsx } from '../utils/exportUtils';
import { FilterIcon } from './icons/FilterIcon';



// Predefined colors for chart elements
const COLORS = [
  '#ca8a04', // primary-600
  '#1e293b', // secondary-800
  '#64748b', // secondary-500
  '#a16207', // primary-700
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#713f12', // primary-900
  '#0f172a', // secondary-900
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#d946ef', // fuchsia-500
  '#f43f5e', // rose-500
  '#14b8a6', // teal-500
  '#84cc16', // lime-500
  '#475569', // secondary-600
];

type YCalculation = 'count' | 'sum' | 'cumulativeSum';
type ChartType = 'bar' | 'line' | 'pie' | 'area';
type LabelDisplay = 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';

interface ChartConstructorProps {
    data: any[];
    columns: { accessor: string, header: string }[];
    config: {
        x: string;
        yCalculation: YCalculation;
        yValueColumn: string;
        group: string;
        type: ChartType;
        labelDisplay: LabelDisplay;
    };
    onConfigChange: (key: 'x' | 'yCalculation' | 'yValueColumn' | 'group' | 'type' | 'labelDisplay', value: string) => void;
    filters: {
        x: string[] | null;
        group: string[] | null;
    };
    onFilterChange: (key: 'x' | 'group', value: string[] | null) => void;
}

const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const FilterDropdown: React.FC<{
    options: string[];
    selected: string[] | null;
    onChange: (newSelection: string[]) => void;
    title: string;
}> = ({ options, selected, onChange, title }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const effectiveSelection = selected === null ? options : selected;
    
    const handleToggle = (option: string) => {
        const newSelection = effectiveSelection.includes(option)
            ? effectiveSelection.filter(item => item !== option)
            : [...effectiveSelection, option];
        onChange(newSelection);
    };

    const handleSelectAll = () => onChange(options);
    const handleDeselectAll = () => onChange([]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-md text-secondary-500 hover:bg-secondary-200 hover:text-primary-700 transition-colors"
                title={title}
            >
                <FilterIcon />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl z-50 border border-secondary-200 animate-slide-in-up origin-top-right">
                    <div className="p-3 border-b">
                        <p className="font-semibold text-secondary-800">{t('filterValues')}</p>
                    </div>
                    <div className="p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={handleSelectAll} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}</button>
                            <span className="text-secondary-300">|</span>
                            <button onClick={handleDeselectAll} className="text-xs font-semibold text-primary-600 hover:underline">{t('deselectAll')}</button>
                        </div>
                         <p className="text-xs text-secondary-500">{t('filterSelectionInfo', { selected: effectiveSelection.length, total: options.length })}</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto border-t p-1">
                        {options.map(option => (
                             <label key={option} className="flex items-center p-1 hover:bg-primary-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={effectiveSelection.includes(option)}
                                    onChange={() => handleToggle(option)}
                                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="ml-2 block text-sm text-secondary-700 truncate">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 p-3 rounded-lg shadow-xl border border-secondary-200">
                <p className="font-bold text-secondary-800 mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((pld: any, index: number) => (
                        <div key={pld.dataKey || index} className="flex items-center text-sm">
                            <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: pld.color || pld.fill }}></span>
                            <span className="text-secondary-600 mr-2">{pld.name}:</span>
                            <span className="font-semibold text-secondary-800">{typeof pld.value === 'number' ? pld.value.toLocaleString() : pld.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};


const ChartConstructor: React.FC<ChartConstructorProps> = ({ data, columns, config, onConfigChange, filters, onFilterChange }) => {
    const { t } = useLanguage();
    const chartRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState<'png' | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(true);
    const renderedLabelsYPos = useRef({ right: [] as number[], left: [] as number[] });

    const uniqueXValues = useMemo(() => {
        if (!config.x) return [];
        return Array.from(new Set(data.map(item => String(item[config.x] ?? 'N/A')))).sort((a: string, b: string) => a.localeCompare(b, undefined, {numeric: true}));
    }, [data, config.x]);

    const uniqueGroupValues = useMemo(() => {
        if (!config.group || config.group === 'none') return [];
        return Array.from(new Set(data.map(item => String(item[config.group] ?? 'N/A')))).sort();
    }, [data, config.group]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const xValue = String(item[config.x] ?? 'N/A');
            const groupValue = config.group !== 'none' ? String(item[config.group] ?? 'N/A') : '_total';
            const isXSelected = filters.x === null || filters.x.includes(xValue);
            const isGroupSelected = filters.group === null || config.group === 'none' || filters.group.includes(groupValue);
            return isXSelected && isGroupSelected;
        });
    }, [data, config, filters]);

    const { chartData, groupKeys } = useMemo(() => {
        if (!config.x || filteredData.length === 0) {
            return { chartData: [], groupKeys: [] };
        }

        const dataMap = new Map<string, any>();
        const dynamicGroupKeys = new Set<string>();

        filteredData.forEach(item => {
            const xAxisValue = item[config.x] !== null && item[config.x] !== undefined ? String(item[config.x]) : 'N/A';
            const groupValue = config.group !== 'none' && item[config.group] !== null && item[config.group] !== undefined ? String(item[config.group]) : '_total';

            if (groupValue !== '_total') {
                dynamicGroupKeys.add(groupValue);
            }

            if (!dataMap.has(xAxisValue)) {
                dataMap.set(xAxisValue, { name: xAxisValue });
            }

            const entry = dataMap.get(xAxisValue);
            
            let valueToAdd = 1;
            if (config.yCalculation === 'sum' || config.yCalculation === 'cumulativeSum') {
                const rawValue = item[config.yValueColumn];
                const numericValue = parseFloat(String(rawValue || '0').replace(',', '.'));
                valueToAdd = isNaN(numericValue) ? 0 : numericValue;
            }

            entry[groupValue] = (entry[groupValue] || 0) + valueToAdd;
        });
        
        const sortedGroupKeys = Array.from(dynamicGroupKeys).sort();
        if (config.group === 'none' || config.group === '_total' || sortedGroupKeys.length === 0) {
            sortedGroupKeys.splice(0, sortedGroupKeys.length, '_total');
        }

        const isYearAxis = (config.type === 'line' || config.type === 'area') && (config.x === 'year' || config.x === 'publication_year');
        if (isYearAxis) {
            const yearValues = filteredData.map(d => parseInt(d[config.x], 10)).filter(y => !isNaN(y));
            if (yearValues.length > 0) {
                const minYear = Math.min(...yearValues);
                const maxYear = Math.max(...yearValues);
                for (let year = minYear; year <= maxYear; year++) {
                    const yearStr = String(year);
                    if (!dataMap.has(yearStr)) {
                        const newEntry: Record<string, any> = { name: yearStr };
                        sortedGroupKeys.forEach(key => newEntry[key] = 0);
                        dataMap.set(yearStr, newEntry);
                    }
                }
            }
        }

        for (const entry of dataMap.values()) {
            const total = sortedGroupKeys.reduce((sum, key) => sum + (entry[key] || 0), 0);
            entry._total = total;
            for (const key of sortedGroupKeys) {
                if (!entry.hasOwnProperty(key)) {
                    entry[key] = 0;
                }
            }
        }

        const sortedChartData = Array.from(dataMap.values()).sort((a, b) => {
            return String(a.name).localeCompare(String(b.name), undefined, {numeric: true});
        });

        if (config.yCalculation === 'cumulativeSum') {
            const cumulativeSums: { [key: string]: number } = {};
            sortedGroupKeys.forEach(key => cumulativeSums[key] = 0);
            
            sortedChartData.forEach(dataPoint => {
                sortedGroupKeys.forEach(key => {
                    cumulativeSums[key] += dataPoint[key] || 0;
                    dataPoint[key] = cumulativeSums[key];
                });
            });
        }

        return { chartData: sortedChartData, groupKeys: sortedGroupKeys };
    }, [filteredData, config.x, config.yCalculation, config.yValueColumn, config.group, config.type]);

    const pieChartData = useMemo(() => {
        if (config.type !== 'pie' || !config.x || filteredData.length === 0) {
            return [];
        }
        const pieMap = new Map<string, number>();
        filteredData.forEach(item => {
            const name = item[config.x] !== null && item[config.x] !== undefined ? String(item[config.x]) : 'N/A';
            
            let valueToAdd = 1;
            if (config.yCalculation === 'sum' || config.yCalculation === 'cumulativeSum') {
                const rawValue = item[config.yValueColumn];
                const numericValue = parseFloat(String(rawValue || '0').replace(',', '.'));
                valueToAdd = isNaN(numericValue) ? 0 : numericValue;
            }

            pieMap.set(name, (pieMap.get(name) || 0) + valueToAdd);
        });
        return Array.from(pieMap, ([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    }, [filteredData, config.x, config.yCalculation, config.yValueColumn, config.type]);

    const handleDownloadPng = async () => {
        if (!chartRef.current) {
            console.error("Chart reference is not available.");
            return;
        }
        
        setIsDownloading('png');

        try {
            const dataUrl = await htmlToImage.toPng(chartRef.current, { 
                backgroundColor: '#ffffff',
                pixelRatio: 2
            });

            const link = document.createElement('a');
            link.download = 'chart.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download chart:', error);
        } finally {
            setIsDownloading(null);
        }
    };
    
    const handleExportXlsx = () => {
        const xAxisHeader = columns.find(c => c.accessor === config.x)?.header || config.x;
        let excelData: Record<string, any>[] = [];
        
        if (config.type === 'pie') {
            excelData = pieChartData.map(d => ({
                [xAxisHeader]: d.name,
                [config.yValueColumn || t('publicationCount')]: d.value
            }));
        } else {
            excelData = chartData.map(row => {
                const newRow: Record<string, any> = { [xAxisHeader]: row.name };
                groupKeys.forEach(key => {
                    const header = key === '_total' ? (config.yValueColumn || t('publicationCount')) : key;
                    newRow[header] = row[key] || 0;
                });
                return newRow;
            });
        }
    
        if (excelData.length > 0) {
            exportObjectsToXlsx(excelData, 'chart_data.xlsx');
        }
    };

    const CustomizedLabel = (props: any) => {
        const { x, y, width, height, value, payload } = props;
        if (!payload || config.labelDisplay === 'none' || value === 0 || value === undefined) {
            return null;
        }

        const total = payload?._total || 1;
        const percentage = total > 0 ? (value / total) * 100 : 0;
        
        let labelText = '';
        switch(config.labelDisplay) {
            case 'value':
                labelText = value.toLocaleString();
                break;
            case 'percent':
                labelText = `${percentage.toFixed(0)}%`;
                break;
            case 'valueAndPercent':
                labelText = `${value.toLocaleString()} (${percentage.toFixed(0)}%)`;
                break;
        }

        const isBar = config.type === 'bar';
        const textHeight = 12;
        const textFits = height > textHeight + 4;

        return (
            <text 
                x={x + width / 2} 
                y={isBar ? (textFits ? y + height / 2 : y - 4) : y - 4} 
                fill={isBar && textFits ? "#fff" : "#334155"}
                textAnchor="middle" 
                dominantBaseline={isBar && textFits ? "middle" : "auto"}
                fontSize={10}
                fontWeight="bold"
            >
                {labelText}
            </text>
        );
    };
    
    const renderSmartPieLabel = (props: any) => {
        const { cx, cy, midAngle, outerRadius, percent, name, value } = props;

        if (config.labelDisplay === 'none' || value === 0 || value === undefined || value === null) {
            return null;
        }

        const RADIAN = Math.PI / 180;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        
        const wordWrap = (str: string, maxWidthChars: number): string[] => {
            if (!str) return [];
            if (str.length <= maxWidthChars) {
                return [str];
            }
            const words = str.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            for (const word of words) {
                if ((currentLine + ' ' + word).trim().length > maxWidthChars && currentLine.length > 0) {
                    lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = (currentLine + ' ' + word).trim();
                }
            }
            if (currentLine) {
                lines.push(currentLine.trim());
            }
            if (lines.length > 2) {
                return [lines[0], lines[1] + '...'];
            }
            return lines;
        }

        const nameLines = wordWrap(name, 25);

        const labelItems: { text: string, props: any }[] = [];
        switch(config.labelDisplay) {
            case 'value':
                labelItems.push({ text: value.toLocaleString(), props: { fill: '#111827', fontWeight: '500' }});
                break;
            case 'percent':
                labelItems.push({ text: `${(percent * 100).toFixed(1)}%`, props: { fill: '#4b5563', fontWeight: '500' }});
                break;
            case 'valueAndPercent':
                labelItems.push({ text: `${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`, props: { fill: '#111827' }});
                break;
            case 'nameValueAndPercent':
                nameLines.forEach(line => {
                    labelItems.push({ text: line, props: { fill: '#111827', fontWeight: '500' }});
                });
                labelItems.push({ text: `${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`, props: { fill: '#4b5563' }});
                break;
            default:
                return null;
        }
        
        if (labelItems.length === 0) return null;

        const LABEL_CLEARANCE = 12; // Fixed smaller clearance to prevent skipping
        
        
        const sx = cx + (outerRadius + 5) * cos;
        const sy = cy + (outerRadius + 5) * sin;
        const mx = cx + (outerRadius + 20) * cos;
        const my = cy + (outerRadius + 20) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 35;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        const isRight = cos >= 0;
        const side = isRight ? 'right' : 'left';
        
        for (const existingY of renderedLabelsYPos.current[side]) {
            if (Math.abs(ey - existingY) < LABEL_CLEARANCE) {
                return null;
            }
        }
        
        renderedLabelsYPos.current[side].push(ey);

        return (
            <g>
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9ca3af" fill="none" />
                <circle cx={sx} cy={sy} r={2} fill="#9ca3af" stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#111827" dominantBaseline="central" fontSize="11px">
                    {labelItems.map((item, index) => {
                        const lineHeight = 13;
                        const initialDy = -((labelItems.length - 1) * lineHeight) / 2;
                        return (
                            <tspan 
                                key={index} 
                                x={ex + (cos >= 0 ? 1 : -1) * 8} 
                                dy={index === 0 ? initialDy : lineHeight}
                                {...item.props}
                            >
                                {item.text}
                            </tspan>
                        );
                    })}
                </text>
            </g>
        );
    };
    
    const noDataToRender = chartData.length === 0 && pieChartData.length === 0;
    const isFilteredToEmpty = (config.x && filters.x?.length === 0) || (config.group !== 'none' && filters.group?.length === 0);
    
    // Clear label positions before each render
    renderedLabelsYPos.current = { right: [], left: [] };

    const renderChartArea = () => {
        if (!config.x) {
            return (
                <div className="flex items-center justify-center h-96">
                    <p className="text-secondary-500">{t('chartErrorXAxis')}</p>
                </div>
            );
        }
        if (noDataToRender) {
             return (
                <div className="flex items-center justify-center h-96">
                    <p className="text-secondary-500 text-center px-4">{isFilteredToEmpty ? t('chartEmptyDueToFilter') : t('chartNoData')}</p>
                </div>
            );
        }
        return (
            <>
                <div ref={chartRef} className="w-full h-96 bg-white p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        {config.type === 'bar' ? (
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(202, 138, 4, 0.1)' }}/>
                                <Legend />
                                {groupKeys.map((key, index) => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} name={key === '_total' ? t('publicationCount') : key}>
                                       {config.labelDisplay !== 'none' && <LabelList dataKey={key} content={<CustomizedLabel />} />}
                                    </Bar>
                                ))}
                            </BarChart>
                        ) : config.type === 'line' ? (
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {groupKeys.map((key, index) => (
                                    <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} name={key === '_total' ? t('publicationCount') : key} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                                       {config.labelDisplay !== 'none' && <LabelList dataKey={key} content={<CustomizedLabel />} />}
                                    </Line>
                                ))}
                            </LineChart>
                        ) : config.type === 'area' ? (
                             <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {groupKeys.map((key, index) => (
                                     <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} name={key === '_total' ? t('publicationCount') : key} />
                                ))}
                            </AreaChart>
                        ) : (
                            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={'70%'}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={renderSmartPieLabel}
                                    minAngle={5}
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                </div>
                 <div className="flex justify-end items-center gap-4 mt-4">
                    <button
                        onClick={handleDownloadPng}
                        disabled={!!isDownloading}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                    >
                        {isDownloading === 'png' ? <Loader /> : <DownloadIcon />}
                        <span>{t('downloadPNG')}</span>
                    </button>
                    <button
                        onClick={handleExportXlsx}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 shadow-md"
                    >
                        <DownloadIcon />
                        <span>{t('downloadXLSX')}</span>
                    </button>
                </div>
            </>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-secondary-50 border border-secondary-200 rounded-xl">
                 <div
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-secondary-100/50 rounded-t-xl transition-colors"
                    onClick={() => setIsSettingsVisible(!isSettingsVisible)}
                    aria-expanded={isSettingsVisible}
                 >
                    <h4 className="text-lg font-bold text-secondary-800">{t('visualizationConstructor')}</h4>
                    <ChevronDownIcon className={`transform transition-transform duration-300 ${isSettingsVisible ? 'rotate-180' : ''}`} />
                 </div>
                {isSettingsVisible && (
                    <div className="p-4 border-t border-secondary-200 animate-slide-in-up">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('xAxisLabel')}</label>
                                <div className="flex items-center gap-1">
                                    <select value={config.x} onChange={e => onConfigChange('x', e.target.value)} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                        <option value="">-- {t('batchSelectKey')} --</option>
                                        {columns.map(c => <option key={c.accessor} value={c.accessor}>{c.header}</option>)}
                                    </select>
                                    {config.x && (
                                        <FilterDropdown 
                                            options={uniqueXValues}
                                            selected={filters.x}
                                            onChange={(newSelection) => onFilterChange('x', newSelection.length === uniqueXValues.length ? null : newSelection)}
                                            title={t('filterByTitle', { column: columns.find(c=>c.accessor === config.x)?.header || '' })}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-secondary-600 mb-1">{t('yAxisCalculation')}</label>
                                    <select value={config.yCalculation} onChange={e => onConfigChange('yCalculation', e.target.value)} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                        <option value="count">{t('yAxisCalcCount')}</option>
                                        <option value="sum">{t('yAxisCalcSum')}</option>
                                        <option value="cumulativeSum">{t('yAxisCalcCumulativeSum')}</option>
                                    </select>
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-secondary-600 mb-1">{t('yAxisValueColumn')}</label>
                                    <select value={config.yValueColumn} onChange={e => onConfigChange('yValueColumn', e.target.value)} disabled={config.yCalculation === 'count'} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-secondary-200">
                                        <option value="">-- {t('batchSelectKey')} --</option>
                                        {columns.map(c => <option key={c.accessor} value={c.accessor}>{c.header}</option>)}
                                    </select>
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('groupByLabel')}</label>
                                <div className="flex items-center gap-1">
                                    <select value={config.group} onChange={e => onConfigChange('group', e.target.value)} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400" disabled={config.type === 'pie'}>
                                        <option value="none">{t('groupByNone')}</option>
                                        {columns.filter(c => c.accessor !== config.x).map(c => <option key={c.accessor} value={c.accessor}>{c.header}</option>)}
                                    </select>
                                    {config.group !== 'none' && config.type !== 'pie' &&
                                        <FilterDropdown 
                                            options={uniqueGroupValues}
                                            selected={filters.group}
                                            onChange={(newSelection) => onFilterChange('group', newSelection.length === uniqueGroupValues.length ? null : newSelection)}
                                            title={t('filterByTitle', { column: columns.find(c=>c.accessor === config.group)?.header || '' })}
                                        />
                                    }
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('labelDisplayLabel')}</label>
                                <select value={config.labelDisplay} onChange={e => onConfigChange('labelDisplay', e.target.value)} className="w-full p-2 border border-secondary-300 rounded-lg bg-white text-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400">
                                    <option value="none">{t('labelDisplayNone')}</option>
                                    <option value="value">{t('labelDisplayValue')}</option>
                                    <option value="percent">{t('labelDisplayPercent')}</option>
                                    <option value="valueAndPercent">{t('labelDisplayValueAndPercent')}</option>
                                    <option value="nameValueAndPercent">{t('labelDisplayNameValueAndPercent')}</option>
                                </select>
                            </div>
                             <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-secondary-600 mb-1">{t('chartTypeLabel')}</label>
                                <div className="flex items-center bg-white border border-secondary-300 rounded-lg p-1 space-x-1">
                                    {(['bar', 'line', 'area', 'pie'] as const).map(type => (
                                        <button key={type} onClick={() => onConfigChange('type', type)} className={`w-full text-sm py-1 rounded-md transition-colors ${config.type === type ? 'bg-primary-500 text-white shadow' : 'text-secondary-600 hover:bg-secondary-100'}`}>
                                            {t(`${type}Chart`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white rounded-xl border border-secondary-200 shadow-sm">
                {renderChartArea()}
            </div>
        </div>
    );
};

export default ChartConstructor;
