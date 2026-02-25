




export interface ScopusPublication {
  author_scopus: string;
  h_index: string | number | null;
  eid: string;
  title: string;
  doi: string;
  year: string;
  pub_type: string;
  journal: string;
  journal_id: string;
  pages: string;
  volume: string;
  issue: string;
  issn: string;
  eissn: string;
  open_access: string;
  citedby_count: string;
  affil_knu: boolean;
  affil_rf: boolean;
}

export interface OrcidWork {
  orcid: string;
  title: string;
  journal: string | null;
  year: string | null;
  doi: string | null;
  sours: string;
  type: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  issn: string | null;
  eissn: string | null;
  put_code: string | null;
}

// Fix: Add PublicationMeta type to be used by metadata services.
export interface PublicationMeta {
    volume: string | null;
    issue: string | null;
    pages: string | null;
    issn: string | null;
    eissn: string | null;
}

export interface YearRange {
  start?: number;
  end?: number;
}

export interface AuthorMetrics {
  hIndex: string | number | null;
}

export interface AuthorProfile {
  'Автор': string;
  'ORCID': string;
  'WOS': string;
  'SCOPUS': string;
  'Факультет': string;
  'Посада': string;
}

// Fix: Define GenericPublication for unifying data from different sources.
export interface GenericPublication {
  source: 'Scopus' | 'ORCID' | 'N/A';
  h_index?: string | number | null;
  title: string;
  scopus_publication_id?: string | null;
  orcid_put_code?: string | null;
  journal: string | null;
  journal_source_id?: string | null;
  year: string | null;
  doi: string | null;
  type: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  issn: string | null;
  eissn: string | null;
  citations: string | number | null;
  open_access?: string | null;
  affil_knu?: boolean | null;
  affil_rf?: boolean | null;
}

// Fix: Define UnifiedPublication as a combination of AuthorProfile and GenericPublication.
export type UnifiedPublication = AuthorProfile & GenericPublication;

// Types for APA Generator
export interface Author {
  name: string;
  orcid?: string;
  affiliation?: string;
}

export interface ParsedPublicationData {
    title?: string;
    authors: Author[];
    journalName?: string;
    publicationDate?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;
    abstract?: string;
    keywords: string[];
    pdfUrl?: string;
    apaCitation?: string;
}

export interface EnabledMetadataServices {
    crossref: boolean;
    datacite: boolean;
    zenodo: boolean;
}

export interface OpenAlexWorkType {
    id: string;
    display_name: string;
}

export interface OpenAlexPublication {
  id: string;
  doi: string;
  title: string;
  publication_year: number;
  type: string;
  authors: string;
  journal: string;
  cited_by_count: number;
  open_access_status: string;
  url: string;
  knu_authors_orcid?: string;
}

// H-Index Calculator Types
export interface HIndexProgress {
    currentYear: number;
    totalYears: number;
    publicationsFetchedThisYear: number;
    totalPublicationsFetched: number;
    message: string;
}

export interface HIndexPublication {
    title: string;
    doi: string;
    citedby_count: number;
    publication_date?: string;
    indexing_date?: string;
}

export interface HIndexResult {
    hIndex: number;
    totalPublications: number;
    calculationTime: number; // in seconds
    publications: HIndexPublication[]; 
}

export interface ScopusCitationTabState {
    apiKey: string;
    isLoading: boolean;
    error: string | null;
    statusText: string;
    
    // Mode-specific state
    mode: 'single' | 'file';

    // Single author mode
    authorId: string;
    startYear: string;
    endYear: string;
    totalCitations: number;
    processedPublications: number;
    hIndex: number | string | null;
    results: { year: number; citations: number }[];
    chartColumns: { accessor: string; header: string }[];
    apiLog: any[];
    
    // File processing mode
    file: File | null;
    fileName: string;
    headers: string[];
    originalData: any[];
    processedData: any[] | null;
    sourceColumn: string;
    totalCitationsColumn: string;
    hIndexColumn: string;
    writeMode: 'overwrite' | 'fillEmpty';
    newColNameTotal: string;
    newColNameHIndex: string;
}
export interface StatisticsResult {
    hIndex?: number | string | null;
    totalCitations?: number;
    pubsByTypeAndYear?: {
        headers: string[];
        data: Record<string, string | number>[];
    };
    uniqueScopusPubsByTypeAndYear?: {
        headers: string[];
        data: Record<string, string | number>[];
    };
    uniqueOrcidPubsByTypeAndYear?: {
        headers: string[];
        data: Record<string, string | number>[];
    };
    pubsByYear?: { year: string; count: number }[];
    pubsByType?: { type: string; count: number }[];
}
