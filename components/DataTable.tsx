
import React, { useRef, useState, useLayoutEffect, useEffect, useMemo } from 'react';
import { ExportIcon } from './icons/ExportIcon';
import { useLanguage } from '../contexts/LanguageContext';
import ScrollToTopButton from './ScrollToTopButton';
import { SearchIcon } from './icons/SearchIcon';
import { logEvent } from '../services/analyticsService';

declare const XLSX: any;

export interface Column<T> {
  header: string;
  accessor: keyof T;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  filename: string;
  fixedHeight?: boolean;
}

type SortDirection = 'ascending' | 'descending';

const DataTable = <T extends object,>({ columns, data, filename, fixedHeight = false }: DataTableProps<T>) => {
  const { t } = useLanguage();
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const syncRequestRef = useRef<number | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: SortDirection } | null>(null);

  const processedData = useMemo(() => {
    let processableData = [...data];

    // Filtering
    if (searchTerm) {
        processableData = processableData.filter(row =>
            columns.some(col => {
                const value = row[col.accessor];
                return String(value ?? '').toLowerCase().includes(searchTerm.toLowerCase());
            })
        );
    }

    // Sorting
    if (sortConfig !== null) {
        processableData.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            
            const numA = Number(valA);
            const numB = Number(valB);

            if (typeof valA === 'number' && typeof valB === 'number') {
                 if (valA < numB) return sortConfig.direction === 'ascending' ? -1 : 1;
                 if (valA > numB) return sortConfig.direction === 'ascending' ? 1 : -1;
                 return 0;
            }
            
            if (typeof valA === 'string' && typeof valB === 'string' && !isNaN(numA) && !isNaN(numB)) {
                 if (numA < numB) return sortConfig.direction === 'ascending' ? -1 : 1;
                 if (numA > numB) return sortConfig.direction === 'ascending' ? 1 : -1;
                 return 0;
            }

            // Fallback to string comparison
            if (String(valA).toLowerCase() < String(valB).toLowerCase()) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (String(valA).toLowerCase() > String(valB).toLowerCase()) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }

    return processableData;
  }, [data, searchTerm, sortConfig, columns]);

  const requestSort = (key: keyof T) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };


  useLayoutEffect(() => {
    const tableContainer = tableWrapperRef.current;
    if (!tableContainer) return;

    const checkScrollable = () => {
      const { scrollWidth, clientWidth } = tableContainer;
      const scrollable = scrollWidth > clientWidth;
      setIsScrollable(scrollable);
      if (scrollable) {
        setTableScrollWidth(scrollWidth);
      }
    };

    checkScrollable();
    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(tableContainer);
    const tableEl = tableContainer.querySelector('table');
    if (tableEl) {
      resizeObserver.observe(tableEl);
    }
    return () => resizeObserver.disconnect();
  }, [processedData, columns]);

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableWrapper = tableWrapperRef.current;
    if (!isScrollable || !topScroll || !tableWrapper) return;

    const handleTopScroll = () => {
      if (syncRequestRef.current) cancelAnimationFrame(syncRequestRef.current);
      syncRequestRef.current = requestAnimationFrame(() => {
        if (tableWrapper.scrollLeft !== topScroll.scrollLeft) {
          tableWrapper.scrollLeft = topScroll.scrollLeft;
        }
        syncRequestRef.current = null;
      });
    };

    const handleTableScroll = () => {
      if (syncRequestRef.current) cancelAnimationFrame(syncRequestRef.current);
      syncRequestRef.current = requestAnimationFrame(() => {
        if (topScroll.scrollLeft !== tableWrapper.scrollLeft) {
          topScroll.scrollLeft = tableWrapper.scrollLeft;
        }
        syncRequestRef.current = null;
      });
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableWrapper.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableWrapper.removeEventListener('scroll', handleTableScroll);
      if (syncRequestRef.current) cancelAnimationFrame(syncRequestRef.current);
    };
  }, [isScrollable]);
  
  const exportToXlsx = () => {
    logEvent('data_exported', { filename, row_count: processedData.length });
    const worksheetData = processedData.map(row => {
        const newRow: {[key: string]: any} = {};
        columns.forEach(col => {
            const accessorStr = col.accessor as string;
            const value = row[col.accessor];
            
            if (accessorStr === 'affil_knu') {
                newRow[col.header] = value ? t('yes') : t('no');
            } else if (typeof value === 'boolean') {
                 newRow[col.header] = value ? t('yes') : t('no');
            } else {
                 newRow[col.header] = value ?? '';
            }
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Publications");

    const colWidths = columns.map(col => ({
        wch: Math.max(
            col.header.length,
            ...processedData.map(row => {
                const value = row[col.accessor];
                if (typeof value === 'boolean' || col.accessor === 'affil_knu' || col.accessor === 'author_has_knu_affil') return 3;
                return String(value ?? '').length;
            })
        ) + 2
    }));
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, filename);
  };

  const SortIndicator: React.FC<{accessor: keyof T}> = ({ accessor }) => {
    if (!sortConfig || sortConfig.key !== accessor) {
        return <span className="opacity-0 group-hover:opacity-100 text-secondary-400">↕</span>;
    }
    return <span>{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
  };

  return (
    <div className="animate-slide-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="relative w-full sm:max-w-xs">
            <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                aria-label={t('searchPlaceholder')}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-secondary-400">
                <SearchIcon />
            </div>
        </div>
        <button
          onClick={exportToXlsx}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-2xl hover:-translate-y-1 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center space-x-2 shadow-lg w-full sm:w-auto justify-center"
        >
          <ExportIcon />
          <span>{t('exportButton')}</span>
        </button>
      </div>

      {searchTerm && (
        <div className="text-sm text-secondary-600 mb-3">
          {t('tableShowingEntries', { count: processedData.length, total: data.length })}
        </div>
      )}

      {isScrollable && (
          <div 
              ref={topScrollRef} 
              className="overflow-x-auto overflow-y-hidden"
          >
              <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
          </div>
      )}

      <div ref={tableWrapperRef} className={`rounded-xl border border-secondary-200 shadow-sm ${fixedHeight ? 'overflow-auto max-h-[600px]' : 'overflow-x-auto'}`}>
        <table className="min-w-full divide-y divide-secondary-200 bg-white">
          <thead className={`bg-secondary-50 ${fixedHeight ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {columns.map((col, index) => (
                <th key={index} scope="col" className="px-6 py-3 text-left text-xs uppercase tracking-wider">
                  <button 
                    onClick={() => requestSort(col.accessor)} 
                    className="flex items-center gap-2 group font-semibold text-secondary-600"
                    aria-label={`Sort by ${col.header}`}
                  >
                    <span>{col.header}</span>
                    <SortIndicator accessor={col.accessor} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-200">
            {processedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-primary-50 transition-colors duration-200">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-secondary-700">
                    {(() => {
                        const value = row[col.accessor];
                        const accessorStr = col.accessor as string;

                        if (accessorStr === 'author_has_knu_affil') {
                            const hasAffiliation = !!value;
                            return <span className={`font-semibold ${hasAffiliation ? 'text-blue-600' : 'text-secondary-500'}`}>{hasAffiliation ? t('yes') : t('no')}</span>;
                        }

                        if (accessorStr === 'affil_knu') {
                            if (value === null || value === undefined) return '';
                            const hasAffiliation = !!value;
                            return <span className={`font-semibold ${hasAffiliation ? 'text-green-600' : 'text-red-600'}`}>{hasAffiliation ? t('yes') : t('no')}</span>;
                        }

                        if (accessorStr === 'affil_rf') {
                            if (value === null || value === undefined) return '';
                            const hasRfAffiliation = value === true;
                            return <span className={`font-semibold ${hasRfAffiliation ? 'text-red-600' : 'text-green-600'}`}>{hasRfAffiliation ? t('yes') : t('no')}</span>;
                        }

                        if (typeof value === 'boolean') {
                            return <span className={`font-semibold ${value ? 'text-green-600' : 'text-secondary-500'}`}>{value ? t('yes') : t('no')}</span>;
                        }
                        
                        if (typeof value === 'string' && value.trim() !== '') {
                            if (accessorStr.toLowerCase().includes('doi')) {
                                return (
                                    <a href={`https://doi.org/${value}`} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:text-primary-900 hover:underline font-medium">
                                        {value}
                                    </a>
                                );
                            }
                            if (accessorStr.toLowerCase().includes('url')) {
                                return (
                                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:text-primary-900 hover:underline font-medium">
                                        {value}
                                    </a>
                                );
                            }
                        }
                        
                        return String(value ?? '');
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollToTopButton />
    </div>
  );
};

export default DataTable;
