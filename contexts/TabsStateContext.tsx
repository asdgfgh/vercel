
import React, { createContext, useContext, ReactNode, useState } from 'react';
import type { EnabledMetadataServices, OpenAlexWorkType, HIndexProgress, HIndexResult, ScopusCitationTabState, StatisticsResult } from '../types';


// State Interfaces
interface ScopusTabState {
  authorIds: string;
  startYear: string;
  endYear: string;
  file: File | null;
  fileName: string;
  results: Record<string, any>[];
  isLoading: boolean;
  error: string | null;
  statusText: string;
  progress: { current: number; total: number } | null;
  fileHeaders: string[];
  sourceColumn: string;
  originalData: Record<string, any>[];
  groupingColumn: string;
  statsStartYear: string;
  statsEndYear: string;
  isFilterEnabled: boolean;
  filterColumn: string;
  uniqueFilterValues: string[];
  selectedFilterValues: string[];
  // Chart Constructor State
  chartColumns: {accessor: string, header: string}[];
  chartConfigX: string;
  chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
  chartConfigYValueColumn: string;
  chartConfigGroup: string;
  chartConfigType: 'bar' | 'line' | 'pie' | 'area';
  chartConfigFilterX: string[] | null;
  chartConfigFilterGroup: string[] | null;
  chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
  // Dashboard State
  dashboardLayouts: any;
  dashboardWidgets: DashboardWidget[];
}

export interface DashboardWidget {
    id: string;
    type: string;
    name?: string;
    config?: {
        x?: string;
        y?: string;
        group?: string;
        chartType?: 'bar' | 'line' | 'pie';
        startYear?: string;
        endYear?: string;
        filters?: {
            x: string[] | null;
            group: string[] | null;
        };
        title?: string;
        content?: string;
        authorKey?: string;
        yearKey?: string;
        typeKey?: string;
        labelDisplay?: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
        colorPalette?: string;
    };
}

interface OrcidTabState {
  orcidIds: string;
  startYear: string;
  endYear: string;
  file: File | null;
  fileName: string;
  results: Record<string, any>[];
  isLoading: boolean;
  error: string | null;
  statusText: string;
  progress: { current: number; total: number } | null;
  fileHeaders: string[];
  sourceColumn: string;
  originalData: Record<string, any>[];
  groupingColumn: string;
  statsStartYear: string;
  statsEndYear: string;
  enabledServices: EnabledMetadataServices;
  isFilterEnabled: boolean;
  filterColumn: string;
  uniqueFilterValues: string[];
  selectedFilterValues: string[];
   // Chart Constructor State
  chartColumns: {accessor: string, header: string}[];
  chartConfigX: string;
  chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
  chartConfigYValueColumn: string;
  chartConfigGroup: string;
  chartConfigType: 'bar' | 'line' | 'pie' | 'area';
  chartConfigFilterX: string[] | null;
  chartConfigFilterGroup: string[] | null;
  chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
  // Deduplication State
  deduplicationMethod: 'standard' | 'advanced';
  manualReviewList: any[];
  deduplicationLog: any[];
  jaroWinklerMatchThreshold: number;
  jaroWinklerReviewThreshold: number;
  processStats: { orcidInitial: number; totalFinal: number; duplicatesRemoved: number; } | null;
  reviewIndex: number;
  reviewGroups: any[][];
  // Dashboard State
  dashboardLayouts: any;
  dashboardWidgets: DashboardWidget[];
}

interface UnifiedProfileTabState {
  startYear: string;
  endYear: string;
  file: File | null;
  fileName: string;
  results: Record<string, any>[];
  isLoading: boolean;
  error: string | null;
  statusText: string;
  progress: { current: number; total: number } | null;
  fileHeaders: string[];
  scopusColumn: string;
  orcidColumn: string;
  originalData: Record<string, any>[];
  enabledServices: EnabledMetadataServices;
  deduplicationMethod: 'standard' | 'advanced';
  manualReviewList: any[];
  deduplicationLog: any[];
  jaroWinklerMatchThreshold: number;
  jaroWinklerReviewThreshold: number;
  processStats: { scopusInitial: number; orcidInitial: number; totalFinal: number; duplicatesRemoved: number; } | null;
  reviewIndex: number;
  reviewGroups: any[][];
  groupingColumn: string;
  statsStartYear: string;
  statsEndYear: string;
  chartColumns: {accessor: string, header: string}[];
  chartConfigX: string;
  chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
  chartConfigYValueColumn: string;
  chartConfigGroup: string;
  chartConfigType: 'bar' | 'line' | 'pie' | 'area';
  chartConfigFilterX: string[] | null;
  chartConfigFilterGroup: string[] | null;
  chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
  // Dashboard State
  dashboardLayouts: any;
  dashboardWidgets: DashboardWidget[];
}

export interface DataSource {
    name: string;
    headers: string[];
    data: Record<string, any>[];
}

export interface BatchTabState {
    dataSources: DataSource[];
    isLoading: boolean;
    error: string | null;
    mode: 'merge' | 'deduplicate' | 'visualize' | 'fillGroup' | 'interactiveDeduplicate';
    // Merge mode state
    table1Name: string;
    key1: string;
    table2Name: string;
    key2: string;
    columnsToAdd: string[];
    insertionPoint: {
      position: 'end' | 'before' | 'after' | 'replace';
      column: string;
    };
    // Deduplicate mode state
    dedupPrimaryTable: string;
    dedupColumnConfig: Record<string, string[]>;
    // Fill Group mode state
    fillGroupHeaderColumn: string;
    fillGroupNewColumnName: string;
    fillGroupInsertAfterColumn: string;
    // Common result state
    processedData: Record<string, any>[] | null;
    // Visualize mode state
    chartColumns: {accessor: string, header: string}[];
    chartConfigX: string;
    chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
    chartConfigYValueColumn: string;
    chartConfigGroup: string;
    chartConfigType: 'bar' | 'line' | 'pie' | 'area';
    chartConfigFilterX: string[] | null;
    chartConfigFilterGroup: string[] | null;
    chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
    // Dashboard State
    dashboardLayouts: any;
    dashboardWidgets: DashboardWidget[];
    // Interactive Deduplication state
    dedupScope: 'document' | 'group';
    dedupGroupColumn: string;
    dedupCompareColumns: string[];
    jaroWinklerMatchThreshold: number;
    jaroWinklerReviewThreshold: number;
    reviewGroups: any[][];
    reviewIndex: number;
    processStats: { initial: number; final: number; review: number; } | null;
}

interface ZenodoTabState {
    publications: any[];
    isLoading: boolean;
    statusText: string;
    progress: { current: number; total: number } | null;
    error: string | null;
    statsStartYear: string;
    statsEndYear: string;
    chartColumns: { accessor: string; header: string }[];
    chartConfigX: string;
    chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
    chartConfigYValueColumn: string;
    chartConfigGroup: string;
    chartConfigType: 'bar' | 'line' | 'pie' | 'area';
    chartConfigFilterX: string[] | null;
    chartConfigFilterGroup: string[] | null;
    chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
    // Dashboard State
    dashboardLayouts: any;
    dashboardWidgets: DashboardWidget[];
}

interface ApaGeneratorTabState {
    file: File | null;
    fileName: string;
    headers: string[];
    data: any[][];
    sourceColumn: string;
    targetColumn: string;
    newColumnName: string;
    isProcessing: boolean;
    progress: { current: number; total: number };
    results: any[][] | null;
    summary: { success: number; error: number } | null;
    error: string | null;
}

interface OpenAlexTabState {
    startYear: string;
    endYear: string;
    publicationTypes: OpenAlexWorkType[];
    selectedPublicationTypes: string[];
    results: OpenAlexPublication[];
    isLoading: boolean;
    error: string | null;
    statusText: string;
    progress: { current: number; total: number } | null;
    isLoadingTypes: boolean;
    statsStartYear: string;
    statsEndYear: string;
    chartColumns: { accessor: string; header: string }[];
    chartConfigX: string;
    chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
    chartConfigYValueColumn: string;
    chartConfigGroup: string;
    chartConfigType: 'bar' | 'line' | 'pie' | 'area';
    chartConfigFilterX: string[] | null;
    chartConfigFilterGroup: string[] | null;
    chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
    // Dashboard State
    dashboardLayouts: any;
    dashboardWidgets: DashboardWidget[];
}

interface HIndexCalculatorTabState {
    affiliationId: string;
    isLoading: boolean;
    error: string | null;
    progress: HIndexProgress | null;
    result: HIndexResult | null;
    startYear: string;
    endYear: string;
}

interface ManualVisualizerTabState {
    mode: 'raw' | 'summary';
    columns: { id: string; name: string }[];
    data: Record<string, any>[];
    summaryTotal: string;
    summaryCategoryColumn: string;
    summaryValueColumn: string;
    summaryGrowthColumn: string;
    summaryData: { id: string; category: string; value: string; growth: string; }[];
    summaryMainValueType: 'bar' | 'line';
    summaryBarSize: number;
    chartColumns: { accessor: string; header: string }[];
    chartConfigX: string;
    chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
    chartConfigYValueColumn: string;
    chartConfigGroup: string;
    chartConfigType: 'bar' | 'line' | 'pie' | 'area';
    chartConfigFilterX: string[] | null;
    chartConfigFilterGroup: string[] | null;
    chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
}

interface UnpaywallTabState {
    email: string;
    file: File | null;
    fileName: string;
    headers: string[];
    data: Record<string, any>[];
    doiColumn: string;
    results: Record<string, any>[];
    isLoading: boolean;
    error: string | null;
    progress: { current: number; total: number } | null;
    statusText: string;
}

interface AdvancedSearchTabState {
    startYear: string;
    endYear: string;
    inputType: 'manual' | 'file';
    scopusIds: string;
    orcidIds: string;
    file: File | null;
    fileName: string;
    headers: string[];
    originalData: Record<string, any>[];
    scopusColumn: string;
    orcidColumn: string;
    outputMode: 'publications' | 'statistics';
    isLoading: boolean;
    error: string | null;
    statusText: string;
    progress: { current: number; total: number } | null;
    publicationResults: Record<string, any>[];
    uniqueScopusResults: Record<string, any>[];
    uniqueOrcidResults: Record<string, any>[];
    statisticsResults: StatisticsResult | null;
    deduplicationMethod: 'standard' | 'advanced';
    enabledServices: EnabledMetadataServices;
    jaroWinklerMatchThreshold: number;
    jaroWinklerReviewThreshold: number;
    deduplicationLog: any[];
    manualReviewList: any[];
    processStats: { scopusInitial: number; orcidInitial: number; totalFinal: number; duplicatesRemoved: number; } | null;
    reviewIndex: number;
    reviewGroups: any[][];
    selectedFields: string[];
    statsToCalculate: {
        hIndex: boolean;
        totalCitations: boolean;
        pubsByTypeAndYear: boolean;
        uniqueScopusPubsByTypeAndYear: boolean;
        uniqueOrcidPubsByTypeAndYear: boolean;
    };
    isReviewComplete: boolean;
    isGeneratingStats: boolean;
    // Chart Constructor State
    chartColumns: {accessor: string, header: string}[];
    chartConfigX: string;
    chartConfigYCalculation: 'count' | 'sum' | 'cumulativeSum';
    chartConfigYValueColumn: string;
    chartConfigGroup: string;
    chartConfigType: 'bar' | 'line' | 'pie' | 'area';
    chartConfigFilterX: string[] | null;
    chartConfigFilterGroup: string[] | null;
    chartConfigLabelDisplay: 'none' | 'value' | 'percent' | 'valueAndPercent' | 'nameValueAndPercent';
    // Dashboard State
    dashboardLayouts: any;
    dashboardWidgets: DashboardWidget[];
}


// Initial States
export const initialScopusState: ScopusTabState = {
  authorIds: '',
  startYear: '',
  endYear: '',
  file: null,
  fileName: '',
  results: [],
  isLoading: false,
  error: null,
  statusText: '',
  progress: null,
  fileHeaders: [],
  sourceColumn: '',
  originalData: [],
  groupingColumn: '',
  statsStartYear: '',
  statsEndYear: '',
  isFilterEnabled: false,
  filterColumn: '',
  uniqueFilterValues: [],
  selectedFilterValues: [],
  chartColumns: [],
  chartConfigX: 'year',
  chartConfigYCalculation: 'count',
  chartConfigYValueColumn: '',
  chartConfigGroup: 'pub_type',
  chartConfigType: 'bar',
  chartConfigFilterX: null,
  chartConfigFilterGroup: null,
  chartConfigLabelDisplay: 'none',
  dashboardLayouts: {},
  dashboardWidgets: [],
};

export const initialOrcidState: OrcidTabState = {
  orcidIds: '',
  startYear: '',
  endYear: '',
  file: null,
  fileName: '',
  results: [],
  isLoading: false,
  error: null,
  statusText: '',
  progress: null,
  fileHeaders: [],
  sourceColumn: '',
  originalData: [],
  groupingColumn: '',
  statsStartYear: '',
  statsEndYear: '',
  enabledServices: { crossref: true, datacite: true, zenodo: true },
  isFilterEnabled: false,
  filterColumn: '',
  uniqueFilterValues: [],
  selectedFilterValues: [],
  chartColumns: [],
  chartConfigX: 'year',
  chartConfigYCalculation: 'count',
  chartConfigYValueColumn: '',
  chartConfigGroup: 'type',
  chartConfigType: 'bar',
  chartConfigFilterX: null,
  chartConfigFilterGroup: null,
  chartConfigLabelDisplay: 'none',
  deduplicationMethod: 'standard',
  manualReviewList: [],
  deduplicationLog: [],
  jaroWinklerMatchThreshold: 97,
  jaroWinklerReviewThreshold: 90,
  processStats: null,
  reviewIndex: -1,
  reviewGroups: [],
  dashboardLayouts: {},
  dashboardWidgets: [],
};

export const initialUnifiedProfileState: UnifiedProfileTabState = {
  startYear: '',
  endYear: '',
  file: null,
  fileName: '',
  results: [],
  isLoading: false,
  error: null,
  statusText: '',
  progress: null,
  fileHeaders: [],
  scopusColumn: '',
  orcidColumn: '',
  originalData: [],
  enabledServices: { crossref: true, datacite: true, zenodo: true },
  deduplicationMethod: 'standard',
  manualReviewList: [],
  deduplicationLog: [],
  jaroWinklerMatchThreshold: 97,
  jaroWinklerReviewThreshold: 90,
  processStats: null,
  reviewIndex: -1,
  reviewGroups: [],
  groupingColumn: '',
  statsStartYear: '',
  statsEndYear: '',
  chartColumns: [],
  chartConfigX: 'year',
  chartConfigYCalculation: 'count',
  chartConfigYValueColumn: '',
  chartConfigGroup: 'pub_type',
  chartConfigType: 'bar',
  chartConfigFilterX: null,
  chartConfigFilterGroup: null,
  chartConfigLabelDisplay: 'none',
  dashboardLayouts: {},
  dashboardWidgets: [],
};

export const initialBatchState: BatchTabState = {
    dataSources: [],
    isLoading: false,
    error: null,
    mode: 'merge',
    table1Name: '',
    key1: '',
    table2Name: '',
    key2: '',
    columnsToAdd: [],
    insertionPoint: {
      position: 'end',
      column: '',
    },
    dedupPrimaryTable: '',
    dedupColumnConfig: {},
    fillGroupHeaderColumn: '',
    fillGroupNewColumnName: 'Кафедра',
    fillGroupInsertAfterColumn: '',
    processedData: null,
    chartColumns: [],
    chartConfigX: '',
    chartConfigYCalculation: 'count',
    chartConfigYValueColumn: '',
    chartConfigGroup: 'none',
    chartConfigType: 'bar',
    chartConfigFilterX: null,
    chartConfigFilterGroup: null,
    chartConfigLabelDisplay: 'none',
    dashboardLayouts: {},
    dashboardWidgets: [],
    dedupScope: 'document',
    dedupGroupColumn: '',
    dedupCompareColumns: [],
    jaroWinklerMatchThreshold: 97,
    jaroWinklerReviewThreshold: 90,
    reviewGroups: [],
    reviewIndex: -1,
    processStats: null,
};

export const initialZenodoState: ZenodoTabState = {
    publications: [],
    isLoading: false,
    statusText: '',
    progress: null,
    error: null,
    statsStartYear: '',
    statsEndYear: '',
    chartColumns: [],
    chartConfigX: 'year',
    chartConfigYCalculation: 'count',
    chartConfigYValueColumn: '',
    chartConfigGroup: 'resourceType',
    chartConfigType: 'bar',
    chartConfigFilterX: null,
    chartConfigFilterGroup: null,
    chartConfigLabelDisplay: 'none',
    dashboardLayouts: {},
    dashboardWidgets: [],
};

export const initialApaState: ApaGeneratorTabState = {
    file: null,
    fileName: '',
    headers: [],
    data: [],
    sourceColumn: '',
    targetColumn: '__NEW_COLUMN__',
    newColumnName: 'APA Citation',
    isProcessing: false,
    progress: { current: 0, total: 0 },
    results: null,
    summary: null,
    error: null,
};

export const initialOpenAlexState: OpenAlexTabState = {
    startYear: '',
    endYear: '',
    publicationTypes: [],
    selectedPublicationTypes: [],
    results: [],
    isLoading: false,
    error: null,
    statusText: '',
    progress: null,
    isLoadingTypes: false,
    statsStartYear: '',
    statsEndYear: '',
    chartColumns: [],
    chartConfigX: 'publication_year',
    chartConfigYCalculation: 'count',
    chartConfigYValueColumn: '',
    chartConfigGroup: 'type',
    chartConfigType: 'bar',
    chartConfigFilterX: null,
    chartConfigFilterGroup: null,
    chartConfigLabelDisplay: 'none',
    dashboardLayouts: {},
    dashboardWidgets: [],
};

export const initialHIndexCalculatorState: HIndexCalculatorTabState = {
    affiliationId: '',
    isLoading: false,
    error: null,
    progress: null,
    result: null,
    startYear: '',
    endYear: '',
};

export const initialManualVisualizerState: ManualVisualizerTabState = {
    mode: 'summary',
    columns: [{ id: 'col1', name: 'Category' }],
    data: [ { col1: 'A' }, { col1: 'B' } ],
    summaryTotal: '',
    summaryCategoryColumn: 'Дата',
    summaryValueColumn: 'Кількість публікацій',
    summaryGrowthColumn: '% зростання',
    summaryData: [
        { id: 'r1', category: '11.12.2020', value: '19428', growth: 'базовий рік' },
        { id: 'r2', category: '19.11.2021', value: '20626', growth: '6.1%' },
        { id: 'r3', category: '22.11.2022', value: '23023', growth: '11.6%' },
        { id: 'r4', category: '22.11.2023', value: '23970', growth: '4.1%' },
        { id: 'r5', category: '11.11.2024', value: '26601', growth: '10.9%' },
    ],
    summaryMainValueType: 'bar',
    summaryBarSize: 80,
    chartColumns: [],
    chartConfigX: 'col1',
    chartConfigYCalculation: 'count',
    chartConfigYValueColumn: '',
    chartConfigGroup: 'none',
    chartConfigType: 'bar',
    chartConfigFilterX: null,
    chartConfigFilterGroup: null,
    chartConfigLabelDisplay: 'value',
};

export const initialUnpaywallState: UnpaywallTabState = {
    email: '',
    file: null,
    fileName: '',
    headers: [],
    data: [],
    doiColumn: '',
    results: [],
    isLoading: false,
    error: null,
    progress: null,
    statusText: '',
};

export const initialScopusCitationState: ScopusCitationTabState = {
    isLoading: false,
    error: null,
    statusText: '',
    mode: 'single',
    authorId: '',
    startYear: new Date().getFullYear().toString(),
    endYear: new Date().getFullYear().toString(),
    totalCitations: 0,
    processedPublications: 0,
    hIndex: null,
    results: [],
    chartColumns: [],
    apiLog: [],
    file: null,
    fileName: '',
    headers: [],
    originalData: [],
    processedData: null,
    sourceColumn: '',
    totalCitationsColumn: '__NEW__',
    hIndexColumn: '__NEW__',
    writeMode: 'overwrite',
    newColNameTotal: 'Total Citations',
    newColNameHIndex: 'H-Index',
};

export const initialAdvancedSearchState: AdvancedSearchTabState = {
    startYear: '',
    endYear: '',
    inputType: 'manual',
    scopusIds: '',
    orcidIds: '',
    file: null,
    fileName: '',
    headers: [],
    originalData: [],
    scopusColumn: '',
    orcidColumn: '',
    outputMode: 'publications',
    isLoading: false,
    error: null,
    statusText: '',
    progress: null,
    publicationResults: [],
    uniqueScopusResults: [],
    uniqueOrcidResults: [],
    statisticsResults: null,
    deduplicationMethod: 'standard',
    enabledServices: { crossref: true, datacite: true, zenodo: true },
    jaroWinklerMatchThreshold: 97,
    jaroWinklerReviewThreshold: 90,
    deduplicationLog: [],
    manualReviewList: [],
    processStats: null,
    reviewIndex: -1,
    reviewGroups: [],
    selectedFields: [
        'source', 'title', 'year', 'pub_type', 'doi', 'journal', 'citedby_count', 'h_index', 'affil_knu', 'affil_rf'
    ],
    statsToCalculate: {
        hIndex: true,
        totalCitations: true,
        pubsByTypeAndYear: true,
        uniqueScopusPubsByTypeAndYear: true,
        uniqueOrcidPubsByTypeAndYear: true,
    },
    isReviewComplete: false,
    isGeneratingStats: false,
    chartColumns: [],
    chartConfigX: 'year',
    chartConfigYCalculation: 'count',
    chartConfigYValueColumn: '',
    chartConfigGroup: 'pub_type',
    chartConfigType: 'bar',
    chartConfigFilterX: null,
    chartConfigFilterGroup: null,
    chartConfigLabelDisplay: 'none',
    dashboardLayouts: {},
    dashboardWidgets: [],
};


// Context Type
interface TabsStateContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  clearAllData: () => void;
  scopusState: ScopusTabState;
  setScopusState: React.Dispatch<React.SetStateAction<ScopusTabState>>;
  orcidState: OrcidTabState;
  setOrcidState: React.Dispatch<React.SetStateAction<OrcidTabState>>;
  unifiedProfileState: UnifiedProfileTabState;
  setUnifiedProfileState: React.Dispatch<React.SetStateAction<UnifiedProfileTabState>>;
  advancedSearchState: AdvancedSearchTabState;
  setAdvancedSearchState: React.Dispatch<React.SetStateAction<AdvancedSearchTabState>>;
  batchState: BatchTabState;
  setBatchState: React.Dispatch<React.SetStateAction<BatchTabState>>;
  zenodoState: ZenodoTabState;
  setZenodoState: React.Dispatch<React.SetStateAction<ZenodoTabState>>;
  apaState: ApaGeneratorTabState;
  setApaState: React.Dispatch<React.SetStateAction<ApaGeneratorTabState>>;
  openAlexState: OpenAlexTabState;
  setOpenAlexState: React.Dispatch<React.SetStateAction<OpenAlexTabState>>;
  hIndexCalculatorState: HIndexCalculatorTabState;
  setHIndexCalculatorState: React.Dispatch<React.SetStateAction<HIndexCalculatorTabState>>;
  manualVisualizerState: ManualVisualizerTabState;
  setManualVisualizerState: React.Dispatch<React.SetStateAction<ManualVisualizerTabState>>;
  unpaywallState: UnpaywallTabState;
  setUnpaywallState: React.Dispatch<React.SetStateAction<UnpaywallTabState>>;
  scopusCitationState: ScopusCitationTabState;
  setScopusCitationState: React.Dispatch<React.SetStateAction<ScopusCitationTabState>>;
  isMykhailoMode: boolean;
  setIsMykhailoMode: (val: boolean) => void;
}

const TabsStateContext = createContext<TabsStateContextType | undefined>(undefined);

export const TabsStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isMykhailoMode, setIsMykhailoMode] = useState<boolean>(false);
  
  const [scopusState, setScopusState] = useState<ScopusTabState>(initialScopusState);
  const [orcidState, setOrcidState] = useState<OrcidTabState>(initialOrcidState);
  const [unifiedProfileState, setUnifiedProfileState] = useState<UnifiedProfileTabState>(initialUnifiedProfileState);
  const [advancedSearchState, setAdvancedSearchState] = useState<AdvancedSearchTabState>(initialAdvancedSearchState);
  const [batchState, setBatchState] = useState<BatchTabState>(initialBatchState);
  const [zenodoState, setZenodoState] = useState<ZenodoTabState>(initialZenodoState);
  const [apaState, setApaState] = useState<ApaGeneratorTabState>(initialApaState);
  const [openAlexState, setOpenAlexState] = useState<OpenAlexTabState>(initialOpenAlexState);
  const [hIndexCalculatorState, setHIndexCalculatorState] = useState<HIndexCalculatorTabState>(initialHIndexCalculatorState);
  const [manualVisualizerState, setManualVisualizerState] = useState<ManualVisualizerTabState>(initialManualVisualizerState);
  const [unpaywallState, setUnpaywallState] = useState<UnpaywallTabState>(initialUnpaywallState);
  const [scopusCitationState, setScopusCitationState] = useState<ScopusCitationTabState>(initialScopusCitationState);
  


  const clearAllData = () => {
    // For each state, reset it to its initial value.
    setScopusState(initialScopusState);
    setOrcidState(initialOrcidState);
    setUnifiedProfileState(initialUnifiedProfileState);
    setAdvancedSearchState(initialAdvancedSearchState);
    setBatchState(initialBatchState);
    setZenodoState(initialZenodoState);
    setApaState(initialApaState);
    setOpenAlexState(initialOpenAlexState);
    setHIndexCalculatorState(initialHIndexCalculatorState);
    setManualVisualizerState(initialManualVisualizerState);
    setUnpaywallState(initialUnpaywallState);
    setScopusCitationState(initialScopusCitationState);
    
    // If you have other states that are not part of the tabs but need clearing,
    // you can add them here. For example:
    // setSomeOtherState(initialSomeOtherState);
  };

  const contextValue: TabsStateContextType = {
    clearAllData,
    scopusState: { ...scopusState, apiKey },
    setScopusState,
    orcidState,
    setOrcidState,
    unifiedProfileState: { ...unifiedProfileState, apiKey },
    setUnifiedProfileState,
    advancedSearchState: { ...advancedSearchState, apiKey },
    setAdvancedSearchState,
    batchState,
    setBatchState,
    zenodoState,
    setZenodoState,
    apaState,
    setApaState,
    openAlexState,
    setOpenAlexState,
    hIndexCalculatorState: { ...hIndexCalculatorState, apiKey },
    setHIndexCalculatorState,
    manualVisualizerState,
    setManualVisualizerState,
    unpaywallState,
    setUnpaywallState,
    scopusCitationState: { ...scopusCitationState, apiKey },
    setScopusCitationState,
    isMykhailoMode,
    setIsMykhailoMode
  };

  return (
    <TabsStateContext.Provider value={contextValue}>
      {children}
    </TabsStateContext.Provider>
  );
};

export const useTabsState = (): TabsStateContextType => {
  const context = useContext(TabsStateContext);
  if (!context) {
    throw new Error('useTabsState must be used within a TabsStateProvider');
  }
  return context;
};
