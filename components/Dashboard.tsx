
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { RefreshIcon } from './icons/RefreshIcon';
import { DashboardWidget } from '../contexts/TabsStateContext';
import { FilterIcon } from './icons/FilterIcon';

import { DownloadIcon } from './icons/DownloadIcon';
import Loader from './Loader';

declare const htmlToImage: any;

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#ca8a04', '#1e293b', '#64748b', '#a16207', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#713f12', '#0f172a', '#10b981', '#06b6d4', '#d946ef', '#f43f5e', '#14b8a6', '#84cc16', '#475569'];
const COLOR_PALETTES: Record<string, string[]> = {
    default: COLORS,
    blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'].reverse(),
    green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'].reverse(),
    red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'].reverse(),
    gray: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'].reverse(),
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

//--- SHARED COMPONENTS ---//

const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const FilterDropdown: React.FC<{ options: string[]; selected: string[] | null; onChange: (newSelection: string[]) => void; title: string; }> = ({ options, selected, onChange, title }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const effectiveSelection = selected === null ? options : selected;
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded-md text-secondary-500 hover:bg-secondary-200 hover:text-primary-700 transition-colors" title={title}>
                <FilterIcon className="h-4 w-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-50 border border-secondary-200 animate-slide-in-up origin-top-right">
                    <div className="p-2 border-b"><p className="font-semibold text-sm text-secondary-800">{t('filterValues')}</p></div>
                    <div className="p-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => onChange(options)} className="text-xs font-semibold text-primary-600 hover:underline">{t('selectAll')}</button>
                            <span className="text-secondary-300">|</span>
                            <button onClick={() => onChange([])} className="text-xs font-semibold text-primary-600 hover:underline">{t('deselectAll')}</button>
                        </div>
                         <p className="text-xs text-secondary-500">{t('filterSelectionInfo', { selected: effectiveSelection.length, total: options.length })}</p>
                    </div>
                    <div className="max-h-36 overflow-y-auto border-t p-1">
                        {options.map(option => (
                             <label key={option} className="flex items-center p-1.5 hover:bg-primary-50 rounded cursor-pointer">
                                <input type="checkbox" checked={effectiveSelection.includes(option)} onChange={() => {
                                    const newSelection = effectiveSelection.includes(option) ? effectiveSelection.filter(item => item !== option) : [...effectiveSelection, option];
                                    onChange(newSelection);
                                }} className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"/>
                                <span className="ml-2 block text-xs text-secondary-700 truncate">{option || 'N/A'}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


//--- WIDGETS ---//

const WidgetContainer: React.FC<{title: string | React.ReactNode, children: React.ReactNode, footer?: React.ReactNode}> = ({ title, children, footer }) => (
    <div className="rounded-lg bg-white border border-secondary-200 h-full flex flex-col overflow-visible">
        <div className="px-4 py-2 border-b border-secondary-200 drag-handle cursor-move bg-secondary-50">
             <div className="font-semibold text-secondary-800 truncate pr-6">{title}</div>
        </div>
        <div className="flex-grow p-4 relative">
            {children}
        </div>
        {footer && (
            <div className="p-2 border-t mt-auto bg-secondary-50">
                {footer}
            </div>
        )}
    </div>
);


const CardMetric: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <WidgetContainer title={title}>
        <div className="flex items-center justify-center h-full">
            <p className="text-5xl font-extrabold text-secondary-800">{value.toLocaleString()}</p>
        </div>
    </WidgetContainer>
);

const PubsByYearWidget: React.FC<{ widget: DashboardWidget; data: any[]; onConfigChange: (newWidgetData: Partial<DashboardWidget>) => void; }> = ({ widget, data, onConfigChange }) => {
    const { t } = useLanguage();
    const config = widget.config || { startYear: '', endYear: '', yearKey: 'year' };
    const yearKey = config.yearKey || 'year';

    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (!item[yearKey]) return false;
            const year = parseInt(item[yearKey], 10);
            const start = config.startYear ? parseInt(config.startYear, 10) : -Infinity;
            const end = config.endYear ? parseInt(config.endYear, 10) : Infinity;
            return !isNaN(year) && year >= start && year <= end;
        });
    }, [data, config.startYear, config.endYear, yearKey]);

    const pubsByYear = useMemo(() => {
        const counts = filteredData.reduce((acc, curr) => {
            const year = curr[yearKey] || 'N/A';
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([year, count]) => ({ year, count })).sort((a,b) => parseInt(a.year) - parseInt(b.year));
    }, [filteredData, yearKey]);

    const handleConfigChange = (key: 'startYear' | 'endYear', value: string) => {
        onConfigChange({ config: { ...config, [key]: value } as any });
    };

    const footer = (
        <div className="grid grid-cols-2 gap-2 text-xs">
             <div>
                <label className="font-medium text-secondary-600 text-xs">{t('fromYearLabel')}</label>
                <input type="number" value={config.startYear || ''} onChange={e => handleConfigChange('startYear', e.target.value)} className="w-full p-1 border rounded text-xs bg-white" placeholder={t('yearPlaceholder')}/>
            </div>
             <div>
                <label className="font-medium text-secondary-600 text-xs">{t('toYearLabel')}</label>
                <input type="number" value={config.endYear || ''} onChange={e => handleConfigChange('endYear', e.target.value)} className="w-full p-1 border rounded text-xs bg-white" placeholder={t('yearPlaceholder2')}/>
            </div>
        </div>
    );

    return (
        <WidgetContainer title={t('dashboardWidgetPubsByYear')} footer={footer}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pubsByYear} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(202, 138, 4, 0.1)' }} />
                    <Legend verticalAlign="top" payload={[{ value: t('publicationCount'), type: 'square', color: COLORS[0] }]} />
                    <Bar dataKey="count" fill={COLORS[0]} name={t('publicationCount')} />
                </BarChart>
            </ResponsiveContainer>
        </WidgetContainer>
    );
};

const GenericPieChart: React.FC<{ title: string; data: any[]; dataKey: string; nameKey: string }> = ({ title, data, dataKey, nameKey }) => (
     <WidgetContainer title={title}>
         <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={'75%'} labelLine={false} label={false} minAngle={5}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />}/>
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    </WidgetContainer>
);

const CustomPieLegend: React.FC<{ data: { name: string; value: number; }[], paletteColors: string[] }> = ({ data, paletteColors }) => {
    const { t } = useLanguage();
    const total = useMemo(() => data.reduce((sum, entry) => sum + entry.value, 0), [data]);
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!data || data.length === 0) return null;

    return (
        <div className="text-sm text-secondary-700 w-full mt-2">
             <div
                className="flex justify-between items-center cursor-pointer p-2 hover:bg-secondary-100 rounded"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h4 className="text-xs font-semibold text-secondary-700">{t('dashboardLegend')}</h4>
                <ChevronDownIcon className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
            {isExpanded && (
                <div className="pt-1 animate-slide-in-up">
                    <ul className="space-y-1">
                        {data.map((entry, index) => {
                            const percentage = total > 0 ? (entry.value / total) * 100 : 0;
                            return (
                                <li key={`item-${index}`} className="flex items-center justify-between p-1 rounded hover:bg-secondary-100">
                                    <div className="flex items-center truncate">
                                        <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: paletteColors[index % paletteColors.length] }}></span>
                                        <span className="truncate" title={entry.name}>{entry.name}</span>
                                    </div>
                                    <div className="font-semibold flex-shrink-0 ml-2 text-right">
                                        <span>{entry.value.toLocaleString()}</span>
                                        <span className="text-secondary-500 ml-2 text-xs">({percentage.toFixed(1)}%)</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

const CustomChartWidget: React.FC<{ widget: DashboardWidget; data: any[]; onConfigChange: (newWidgetData: Partial<DashboardWidget>) => void; columns: { accessor: string; header: string }[] }> = ({ widget, data, onConfigChange, columns }) => {
    const { t } = useLanguage();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const config = widget.config || { x: columns[0]?.accessor || '', y: 'count', group: 'none', chartType: 'bar', startYear: '', endYear: '', filters: { x: null, group: null }, labelDisplay: 'none', colorPalette: 'default' };
    const renderedLabelsYPos = { right: [] as number[], left: [] as number[] };
    
    const PALETTE_NAMES: Record<string, string> = {
        default: t('paletteDefault'),
        blue: t('paletteBlue'),
        green: t('paletteGreen'),
        red: t('paletteRed'),
        gray: t('paletteGray'),
    };

    const paletteColors = COLOR_PALETTES[config.colorPalette || 'default'] || COLORS;

    const { uniqueXValues, uniqueGroupValues } = useMemo(() => {
        const xVals = Array.from(new Set(data.map(item => String(item[config.x!] ?? 'N/A')))).sort((a: string, b: string) => a.localeCompare(b, undefined, {numeric: true}));
        const groupVals = (config.group && config.group !== 'none') ? Array.from(new Set(data.map(item => String(item[config.group!] ?? 'N/A')))).sort() : [];
        return { uniqueXValues: xVals, uniqueGroupValues: groupVals };
    }, [data, config.x, config.group]);

    const filteredData = useMemo(() => {
        const yearColumn = columns.find(c => c.accessor.includes('year'))?.accessor;
        
        return data.filter(item => {
            if (yearColumn && (config.startYear || config.endYear)) {
                if (!item[yearColumn]) return false;
                const year = parseInt(item[yearColumn], 10);
                const start = config.startYear ? parseInt(config.startYear, 10) : -Infinity;
                const end = config.endYear ? parseInt(config.endYear, 10) : Infinity;
                if (isNaN(year) || year < start || year > end) return false;
            }

            const xValue = String(item[config.x!] ?? 'N/A');
            const groupValue = config.group !== 'none' ? String(item[config.group!] ?? 'N/A') : '_total';
            const isXSelected = !config.filters?.x || config.filters.x.includes(xValue);
            const isGroupSelected = !config.filters?.group || config.group === 'none' || config.filters.group.includes(groupValue);
            return isXSelected && isGroupSelected;
        });
    }, [data, config, columns]);

     const { chartData, groupKeys, pieChartData } = useMemo(() => {
        if (!config.x || filteredData.length === 0) return { chartData: [], groupKeys: [], pieChartData: [] };
        
        const dataMap = new Map<string, any>();
        const dynamicGroupKeys = new Set<string>();
        const pieMap = new Map<string, number>();

        filteredData.forEach(item => {
            const xAxisValue = String(item[config.x!] ?? 'N/A');
            const groupValue = (config.group !== 'none' && item[config.group!]) ? String(item[config.group!]) : '_total';
            if (groupValue !== '_total') dynamicGroupKeys.add(groupValue);
            if (!dataMap.has(xAxisValue)) dataMap.set(xAxisValue, { name: xAxisValue });
            const entry = dataMap.get(xAxisValue);
            entry[groupValue] = (entry[groupValue] || 0) + 1;
            pieMap.set(xAxisValue, (pieMap.get(xAxisValue) || 0) + 1);
        });
        
        const sortedGroupKeys = Array.from(dynamicGroupKeys).sort();
        if (config.group === 'none' || sortedGroupKeys.length === 0) sortedGroupKeys.splice(0, sortedGroupKeys.length, '_total');
        
        const isYearAxis = config.chartType === 'line' && (config.x === 'year' || config.x === 'publication_year');
        if (isYearAxis) {
            const yearValues = filteredData.map(d => parseInt(d[config.x!], 10)).filter(y => !isNaN(y));

            const startYearConfig = config.startYear ? parseInt(config.startYear, 10) : NaN;
            const endYearConfig = config.endYear ? parseInt(config.endYear, 10) : NaN;

            const minDataYear = yearValues.length > 0 ? Math.min(...yearValues) : NaN;
            const maxDataYear = yearValues.length > 0 ? Math.max(...yearValues) : NaN;

            const minYear = !isNaN(startYearConfig) ? startYearConfig : minDataYear;
            const maxYear = !isNaN(endYearConfig) ? endYearConfig : maxDataYear;
            
            if (!isNaN(minYear) && !isNaN(maxYear) && minYear <= maxYear) {
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
            entry._total = total; // Add total for stack
            for (const key of sortedGroupKeys) {
                if (!entry.hasOwnProperty(key)) entry[key] = 0;
            }
        }

        const sortedChartData = Array.from(dataMap.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
        const finalPieData = Array.from(pieMap, ([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

        return { chartData: sortedChartData, groupKeys: sortedGroupKeys, pieChartData: finalPieData };
    }, [filteredData, config.x, config.group, config.chartType, config.startYear, config.endYear]);

    const handleLocalConfigChange = (key: 'x' | 'group' | 'chartType' | 'name' | 'startYear' | 'endYear' | 'filters' | 'labelDisplay' | 'colorPalette', value: any) => {
        if (key === 'name') {
            onConfigChange({ name: value });
        } else {
            const newConfig = { ...config, [key]: value };
            if (key === 'chartType' && value === 'pie') newConfig.group = 'none';
            if (key === 'x') newConfig.filters = { ...newConfig.filters, x: null };
            if (key === 'group') newConfig.filters = { ...newConfig.filters, group: null };
            onConfigChange({ config: newConfig });
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
            case 'value': labelText = value.toLocaleString(); break;
            case 'percent': labelText = `${percentage.toFixed(0)}%`; break;
            case 'valueAndPercent': labelText = `${value.toLocaleString()} (${percentage.toFixed(0)}%)`; break;
        }
        const isBar = config.chartType === 'bar';
        const textFits = height > 14;
        return <text x={x + width / 2} y={isBar ? (textFits ? y + height / 2 : y - 4) : y - 4} fill={isBar && textFits ? "#fff" : "#334155"} textAnchor="middle" dominantBaseline={isBar && textFits ? "middle" : "auto"} fontSize={10} fontWeight="bold">{labelText}</text>;
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

        const LABEL_CLEARANCE = 12; 
         
        
        const sx = cx + (outerRadius + 5) * cos;
        const sy = cy + (outerRadius + 5) * sin;
        const mx = cx + (outerRadius + 20) * cos;
        const my = cy + (outerRadius + 20) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 35;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        const isRight = cos >= 0;
        const side = isRight ? 'right' : 'left';
        
        for (const existingY of renderedLabelsYPos[side]) {
            if (Math.abs(ey - existingY) < LABEL_CLEARANCE) {
                return null;
            }
        }
        
        renderedLabelsYPos[side].push(ey);

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

    const titleInput = (
         <input type="text" value={widget.name || t('dashboardWidgetCustomChart')} onChange={(e) => handleLocalConfigChange('name', e.target.value)} className="font-semibold text-secondary-800 bg-transparent w-full border-0 focus:ring-0 p-0" />
    );
    
    const settingsPanel = (
        <div className="space-y-2 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label className="font-medium text-secondary-600 text-xs flex items-center justify-between">{t('xAxisLabel')}
                        <FilterDropdown options={uniqueXValues} selected={config.filters?.x || null} onChange={(sel) => handleLocalConfigChange('filters', {...config.filters, x: sel.length === uniqueXValues.length ? null : sel})} title={t('filterByTitle', {column: ''})}/>
                    </label>
                    <select value={config.x} onChange={e => handleLocalConfigChange('x', e.target.value)} className="w-full p-1 border rounded text-xs bg-white text-black">
                        {columns.map(c => <option key={c.accessor} value={c.accessor} className="bg-white text-black">{c.header}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="font-medium text-secondary-600 text-xs flex items-center justify-between">{t('groupByLabel')}
                         <FilterDropdown options={uniqueGroupValues} selected={config.filters?.group || null} onChange={(sel) => handleLocalConfigChange('filters', {...config.filters, group: sel.length === uniqueGroupValues.length ? null : sel})} title={t('filterByTitle', {column: ''})}/>
                    </label>
                    <select value={config.group} onChange={e => handleLocalConfigChange('group', e.target.value)} disabled={config.chartType === 'pie'} className="w-full p-1 border rounded text-xs bg-white text-black disabled:bg-secondary-200">
                        <option value="none" className="bg-white text-black">{t('groupByNone')}</option>
                        {columns.filter(c => c.accessor !== config.x).map(c => <option key={c.accessor} value={c.accessor} className="bg-white text-black">{c.header}</option>)}
                    </select>
                </div>
            </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="font-medium text-secondary-600 text-xs">{t('fromYearLabel')}</label>
                    <input type="number" value={config.startYear || ''} onChange={e => handleLocalConfigChange('startYear', e.target.value)} className="w-full p-1 border rounded text-xs bg-white" placeholder={t('yearPlaceholder')}/>
                </div>
                <div>
                    <label className="font-medium text-secondary-600 text-xs">{t('toYearLabel')}</label>
                    <input type="number" value={config.endYear || ''} onChange={e => handleLocalConfigChange('endYear', e.target.value)} className="w-full p-1 border rounded text-xs bg-white" placeholder={t('yearPlaceholder2')}/>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="font-medium text-secondary-600 text-xs">{t('dashboardColorPalette')}</label>
                    <select value={config.colorPalette || 'default'} onChange={e => handleLocalConfigChange('colorPalette', e.target.value)} className="w-full p-1 border rounded text-xs bg-white text-black">
                        {Object.keys(PALETTE_NAMES).map(key => (
                            <option key={key} value={key} className="bg-white text-black">{PALETTE_NAMES[key]}</option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label className="font-medium text-secondary-600 text-xs">{t('labelDisplayLabel')}</label>
                    <select value={config.labelDisplay || 'none'} onChange={e => handleLocalConfigChange('labelDisplay', e.target.value)} className="w-full p-1 border rounded text-xs bg-white text-black">
                        <option value="none">{t('labelDisplayNone')}</option>
                        <option value="value">{t('labelDisplayValue')}</option>
                        <option value="percent">{t('labelDisplayPercent')}</option>
                        <option value="valueAndPercent">{t('labelDisplayValueAndPercent')}</option>
                        <option value="nameValueAndPercent">{t('labelDisplayNameValueAndPercent')}</option>
                    </select>
                </div>
            </div>
             <div>
                <label className="font-medium text-secondary-600 text-xs">{t('chartTypeLabel')}</label>
                <div className="flex items-center bg-secondary-200 border border-secondary-300 rounded-md p-0.5 space-x-1">
                    {(['bar', 'line', 'pie'] as const).map(type => (
                        <button key={type} onClick={() => handleLocalConfigChange('chartType', type)} className={`w-full text-xs py-0.5 rounded-sm transition-colors ${config.chartType === type ? 'bg-white text-primary-700 shadow-sm' : 'text-secondary-600 hover:bg-white/50'}`}>
                            {t(`${type}Chart`)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const footer = (
        <>
            <div 
                className="flex justify-between items-center cursor-pointer -m-2 p-2"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
                <h4 className="text-xs font-semibold text-secondary-700">{t('dashboardWidgetSettings')}</h4>
                <ChevronDownIcon className={`transform transition-transform duration-300 ${isSettingsOpen ? 'rotate-180' : ''}`} />
            </div>
            {isSettingsOpen && (
                <div className="pt-2 mt-2 border-t animate-slide-in-up">
                    {settingsPanel}
                </div>
            )}
        </>
    );
    
    // Clear label positions before each render of this widget
    // renderedLabelsYPos is now a local variable, so it's fresh every render


    return (
        <WidgetContainer title={titleInput} footer={footer}>
            {config.chartType === 'pie' ? (
                <div className="h-full w-full flex flex-col">
                    <div className="flex-grow min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={'75%'} labelLine={false} label={renderSmartPieLabel} minAngle={5}>
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={paletteColors[index % paletteColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex-shrink-0">
                        <CustomPieLegend data={pieChartData} paletteColors={paletteColors}/>
                    </div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                     {config.chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" wrapperStyle={{top: -4}}/>
                            {groupKeys.map((key, index) => (
                                <Bar key={key} dataKey={key} stackId="a" fill={paletteColors[index % paletteColors.length]} name={key === '_total' ? t('publicationCount') : key}>
                                    {config.labelDisplay !== 'none' && <LabelList dataKey={key} content={<CustomizedLabel />} />}
                                </Bar>
                            ))}
                        </BarChart>
                    ) : (
                         <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" wrapperStyle={{top: -4}} />
                            {groupKeys.map((key, index) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={paletteColors[index % paletteColors.length]} strokeWidth={2} name={key === '_total' ? t('publicationCount') : key} dot={{ r: 3 }} activeDot={{ r: 5 }}>
                                    {config.labelDisplay !== 'none' && <LabelList dataKey={key} content={<CustomizedLabel />} />}
                                </Line>
                            ))}
                        </LineChart>
                    )}
                </ResponsiveContainer>
            )}
        </WidgetContainer>
    );
};

const BoldIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 ${className}`}><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4.25-4H7v14h7.04c2.1 0 3.71-1.7 3.71-3.78 0-1.52-.86-2.82-2.15-3.43zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9.5h-3.5V13h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"></path></svg> );
const ItalicIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 ${className}`}><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"></path></svg> );
const ListUlIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 ${className}`}><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"></path></svg> );
const ListOlIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg viewBox="0 0 24 24" fill="currentColor" className={`h-4 w-4 ${className}`}><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"></path></svg> );

const TextCardWidget: React.FC<{ widget: DashboardWidget; onConfigChange: (newWidgetData: Partial<DashboardWidget>) => void; }> = ({ widget, onConfigChange }) => {
    const { t } = useLanguage();
    const config = widget.config || { title: '', content: '' };
    const contentRef = useRef<HTMLDivElement>(null);

    const handleConfigChange = (key: 'title' | 'content', value: string) => {
        onConfigChange({ config: { ...config, [key]: value } });
    };

    const handleContentBlur = () => {
        if (contentRef.current) {
            handleConfigChange('content', contentRef.current.innerHTML);
        }
    };
    
    const execCmd = (command: string) => {
        document.execCommand(command, false);
        if (contentRef.current) {
            handleConfigChange('content', contentRef.current.innerHTML);
            contentRef.current.focus();
        }
    }
    
    const handleToolbarMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    const titleInput = (
         <input 
            type="text" 
            value={config.title || ''} 
            onChange={(e) => handleConfigChange('title', e.target.value)} 
            placeholder={t('textWidgetPlaceholderTitle')}
            className="font-semibold text-secondary-800 bg-transparent w-full border-0 focus:ring-0 p-0 placeholder-secondary-400 truncate"
        />
    );

    return (
        <div className="rounded-lg bg-white border border-secondary-200 h-full flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-secondary-200 drag-handle cursor-move bg-secondary-50">
                <div className="font-semibold text-secondary-800 truncate pr-6">{titleInput}</div>
            </div>
            <div className="p-2 border-b border-secondary-200" onMouseDown={handleToolbarMouseDown}>
                 <div className="flex items-center gap-1">
                    <button onClick={() => execCmd('bold')} className="p-1.5 rounded hover:bg-secondary-200 text-secondary-700" title="Bold"><BoldIcon/></button>
                    <button onClick={() => execCmd('italic')} className="p-1.5 rounded hover:bg-secondary-200 text-secondary-700" title="Italic"><ItalicIcon/></button>
                    <div className="w-px h-5 bg-secondary-300 mx-1"></div>
                    <button onClick={() => execCmd('insertUnorderedList')} className="p-1.5 rounded hover:bg-secondary-200 text-secondary-700" title="Unordered List"><ListUlIcon/></button>
                    <button onClick={() => execCmd('insertOrderedList')} className="p-1.5 rounded hover:bg-secondary-200 text-secondary-700" title="Ordered List"><ListOlIcon/></button>
                </div>
            </div>
            <div className="flex-grow p-4 relative overflow-y-auto">
                <div 
                    ref={contentRef}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={handleContentBlur}
                    dangerouslySetInnerHTML={{ __html: config.content || '' }}
                    className="w-full h-full p-0 border-0 focus:ring-0 resize-none text-secondary-700 bg-transparent focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                    data-placeholder={t('textWidgetPlaceholderContent')}
                />
            </div>
        </div>
    );
};


const UniqueAuthorsWidget: React.FC<{ widget: DashboardWidget; data: any[] }> = ({ widget, data }) => {
    const { t } = useLanguage();
    const authorKey = widget.config?.authorKey || 'orcid';
    const uniqueAuthors = useMemo(() => new Set(data.map(d => d[authorKey])).size, [data, authorKey]);
    return <CardMetric title={t('dashboardWidgetUniqueAuthors')} value={uniqueAuthors} />;
};

const PubsByTypeWidget: React.FC<{ widget: DashboardWidget; data: any[] }> = ({ widget, data }) => {
    const { t } = useLanguage();
    const typeKey = widget.config?.typeKey || 'type';
    const pubsByType = useMemo(() => {
        const counts = data.reduce((acc: any, curr: any) => {
            const type = curr[typeKey] || 'N/A';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([type, count]) => ({ type, count }));
    }, [data, typeKey]);
    return <GenericPieChart title={t('dashboardWidgetPubsByType')} data={pubsByType} nameKey="type" dataKey="count" />;
};

const WidgetRenderer: React.FC<{ widget: DashboardWidget; data: any[]; onConfigChange: (newWidgetData: Partial<DashboardWidget>) => void, columns: {accessor: string, header: string}[] }> = ({ widget, data, onConfigChange, columns }) => {
    const { t } = useLanguage();
    switch (widget.type) {
        case 'total_publications':
            return <CardMetric title={t('dashboardWidgetTotalPubs')} value={data.length} />;
        case 'unique_authors':
            return <UniqueAuthorsWidget widget={widget} data={data} />;
        case 'publications_by_year':
            return <PubsByYearWidget widget={widget} data={data} onConfigChange={onConfigChange} />;
        case 'publications_by_type':
            return <PubsByTypeWidget widget={widget} data={data} />;
        case 'custom_chart':
            return <CustomChartWidget widget={widget} data={data} onConfigChange={onConfigChange} columns={columns} />;
        case 'text_card':
            return <TextCardWidget widget={widget} onConfigChange={onConfigChange} />;
        default:
            return <div className="p-4 bg-red-100 rounded-lg">Unknown widget type: {widget.type}</div>;
    }
};

interface DashboardProps {
    data: any[];
    layouts: any;
    widgets: DashboardWidget[];
    onLayoutsChange: (layouts: any) => void;
    onWidgetsChange: (widgets: DashboardWidget[]) => void;
    columns: {accessor: string, header: string}[];
}

const ALL_WIDGETS_CONFIG = [
    { id: 'total_pubs', type: 'total_publications', name: 'dashboardWidgetTotalPubs' },
    { id: 'unique_authors', type: 'unique_authors', name: 'dashboardWidgetUniqueAuthors' },
    { id: 'pubs_by_year', type: 'publications_by_year', name: 'dashboardWidgetPubsByYear' },
    { id: 'pubs_by_type', type: 'publications_by_type', name: 'dashboardWidgetPubsByType' },
    { id: 'custom_chart', type: 'custom_chart', name: 'dashboardWidgetCustomChart' },
    { id: 'text_card', type: 'text_card', name: 'dashboardWidgetTextCard' },
];

const Dashboard: React.FC<DashboardProps> = ({ data, layouts, widgets, onLayoutsChange, onWidgetsChange, columns }) => {
    const { t } = useLanguage();
    const [isMounted, setIsMounted] = useState(false);
    const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
    const addWidgetMenuRef = useRef<HTMLDivElement>(null);
    const widgetRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const dashboardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
        const handleClickOutside = (event: MouseEvent) => {
            if (addWidgetMenuRef.current && !addWidgetMenuRef.current.contains(event.target as Node)) {
                setIsAddWidgetOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDownloadWidgetPng = async (widgetId: string) => {
        const element = widgetRefs.current[widgetId];
        if (!element) {
            console.error("Widget element not found for download.");
            return;
        }

        try {
            const filter = (node: HTMLElement) => !node.classList?.contains('download-hide');
            const dataUrl = await htmlToImage.toPng(element, { 
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                filter,
            });

            const link = document.createElement('a');
            const widget = widgets.find(w => w.id === widgetId);
            const widgetName = widget?.name?.replace(/\s/g, '_') || widgetId;
            link.download = `widget-${widgetName}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download widget as PNG:', error);
        }
    };
    
    const handleDownloadDashboardPng = async () => {
        const element = dashboardRef.current;
        if (!element) {
            console.error("Dashboard element not found for download.");
            return;
        }

        setIsDownloading(true);
        try {
             const filter = (node: HTMLElement) => !node.classList?.contains('download-hide');
            const dataUrl = await htmlToImage.toPng(element, { 
                backgroundColor: '#f1f5f9', // secondary-100
                pixelRatio: 2,
                filter,
            });
            
            const link = document.createElement('a');
            link.download = 'dashboard.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download dashboard as PNG:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleLayoutChange = (layout: any, allLayouts: any) => {
        onLayoutsChange(allLayouts);
    };
    
    const addWidget = (widgetToAdd: {id: string, type: string, name: string}) => {
        const newWidget: DashboardWidget = {
             id: `${widgetToAdd.id}_${Date.now()}`,
             type: widgetToAdd.type,
             name: t(widgetToAdd.name)
        };
        if(widgetToAdd.type === 'custom_chart') {
            newWidget.config = { x: columns[0]?.accessor || '', y: 'count', group: 'none', chartType: 'bar', startYear: '', endYear: '', filters: { x: null, group: null }, labelDisplay: 'none', colorPalette: 'default' };
        }
        if(widgetToAdd.type === 'publications_by_year') {
            newWidget.config = { startYear: '', endYear: '' };
        }
        if(widgetToAdd.type === 'text_card') {
            newWidget.config = { title: t(widgetToAdd.name), content: '' };
        }
        onWidgetsChange([...widgets, newWidget]);
    };
    
    const removeWidget = (widgetId: string) => {
        onWidgetsChange(widgets.filter(w => w.id !== widgetId));
    };

     const handleWidgetConfigChange = (widgetId: string, newWidgetData: Partial<DashboardWidget>) => {
        onWidgetsChange(
            widgets.map(w => (w.id === widgetId ? { ...w, ...newWidgetData } : w))
        );
    };

    const resetLayout = () => {
        const defaultWidgets = [
            { id: 'total_pubs', type: 'total_publications', name: t('dashboardWidgetTotalPubs') },
            { id: 'unique_authors', type: 'unique_authors', name: t('dashboardWidgetUniqueAuthors') },
            { id: 'pubs_by_year', type: 'publications_by_year', name: t('dashboardWidgetPubsByYear'), config: { startYear: '', endYear: '' } },
        ];
        const defaultLayouts = {
            lg: [
                { i: 'total_pubs', x: 0, y: 0, w: 3, h: 2 },
                { i: 'unique_authors', x: 3, y: 0, w: 3, h: 2 },
                { i: 'pubs_by_year', x: 0, y: 2, w: 6, h: 4 },
            ],
        };
        onWidgetsChange(defaultWidgets as any);
        onLayoutsChange(defaultLayouts);
    };

    return (
        <div className="bg-secondary-100 p-4 rounded-lg">
            <div className="flex justify-end items-center gap-2 mb-4">
                 <div className="relative" ref={addWidgetMenuRef}>
                    <button
                        onClick={() => setIsAddWidgetOpen(!isAddWidgetOpen)}
                        className="bg-white text-secondary-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-secondary-200 hover:bg-secondary-50 transition-colors"
                    >
                       {t('dashboardAddWidget')}
                    </button>
                    {isAddWidgetOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-10 border border-secondary-200">
                           {ALL_WIDGETS_CONFIG.map(widget => (
                                <button key={widget.id} onClick={() => { addWidget(widget); setIsAddWidgetOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100">
                                   {t(widget.name)}
                                </button>
                           ))}
                        </div>
                    )}
                 </div>
                <button
                    onClick={resetLayout}
                    className="p-2 bg-white text-secondary-700 rounded-lg shadow-sm border border-secondary-200 hover:bg-secondary-50 transition-colors"
                    title={t('dashboardResetLayout')}
                >
                    <RefreshIcon />
                </button>
                <button
                    onClick={handleDownloadDashboardPng}
                    disabled={isDownloading}
                    className="p-2 bg-white text-secondary-700 rounded-lg shadow-sm border border-secondary-200 hover:bg-secondary-50 transition-colors"
                    title={t('dashboardDownloadAll')}
                >
                    {isDownloading ? <Loader className="text-secondary-700"/> : <DownloadIcon className="w-5 h-5 text-secondary-700"/>}
                </button>
            </div>
            {isMounted && (
                <div ref={dashboardRef}>
                    <ResponsiveGridLayout
                        className="layout"
                        layouts={layouts}
                        onLayoutChange={handleLayoutChange}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                        rowHeight={60}
                        draggableHandle=".drag-handle"
                    >
                        {widgets.map(widget => (
                            <div key={widget.id} ref={el => { widgetRefs.current[widget.id] = el; }} className="relative group bg-transparent">
                                <button
                                    onClick={() => removeWidget(widget.id)}
                                    title={t('dashboardRemoveWidget')}
                                    className="absolute top-2 right-2 p-1 bg-secondary-200/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 download-hide"
                                >
                                <svg className="w-4 h-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                <button
                                    onClick={() => handleDownloadWidgetPng(widget.id)}
                                    title={t('dashboardDownloadWidgetPng')}
                                    className="absolute top-2 right-10 p-1 bg-secondary-200/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 download-hide"
                                >
                                    <DownloadIcon className="w-4 h-4 text-secondary-600" />
                                </button>
                                <WidgetRenderer 
                                    widget={widget} 
                                    data={data} 
                                    onConfigChange={(newWidgetData: Partial<DashboardWidget>) => handleWidgetConfigChange(widget.id, newWidgetData)}
                                    columns={columns}
                                />
                            </div>
                        ))}
                    </ResponsiveGridLayout>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
