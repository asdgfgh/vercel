
import type { ScopusPublication, YearRange, AuthorMetrics } from '../types';

const BASE_URL = "https://api.elsevier.com/content/search/scopus";
const AUTHOR_URL = "https://api.elsevier.com/content/author/author_id/";
const ABSTRACT_URL = "https://api.elsevier.com/content/abstract/eid/";
const CITATION_OVERVIEW_URL = "https://api.elsevier.com/content/abstract/citations";

const KNU_AFFILIATION_ID = '60023137';

const commonHeaders = (apiKey: string): Headers => {
    try {
        const headers = new Headers();
        headers.append("X-ELS-APIKey", apiKey);
        headers.append("Accept", "application/json");
        return headers;
    } catch (e) {
        if (e instanceof TypeError) {
            throw new Error(
                "The Scopus API Key appears to contain invalid characters (e.g., non-ASCII/Cyrillic letters). Please ensure the key is correct and contains only valid ASCII characters."
            );
        }
        throw e;
    }
};

export async function fetchAuthorMetrics(authorId: string, apiKey: string): Promise<AuthorMetrics> {
    const url = `${AUTHOR_URL}${authorId}?view=metrics`;
    try {
        const response = await fetch(url, { headers: commonHeaders(apiKey) });
        if (!response.ok) {
            console.error(`Scopus metrics API error for ${authorId}: ${response.statusText}`);
            return { hIndex: null };
        }
        const data = await response.json();
        const resp = data?.["author-retrieval-response"]?.[0];
        if (resp) {
            const hIndex = resp["h-index"] || resp?.coredata?.["h-index"] || null;
            return { hIndex };
        }
        return { hIndex: null };
    } catch (e) {
        console.error(`Failed to fetch h-index for ${authorId}`, e);
        throw e;
    }
}

async function fetchFullPublicationDetails(eid: string, apiKey: string): Promise<{ authors: any[], affiliations: any[] }> {
    const url = `${ABSTRACT_URL}${eid}?view=FULL`;
    try {
        const response = await fetch(url, { headers: commonHeaders(apiKey) });
        if (!response.ok) {
            console.warn(`Scopus Abstract Retrieval API error for EID ${eid}: ${response.statusText}`);
            return { authors: [], affiliations: [] };
        }
        const data = await response.json();
        const fullDetails = data?.["abstracts-retrieval-response"];
        if (fullDetails) {
            const authors = fullDetails.authors?.author || [];
            const affiliations = fullDetails.affiliation || [];
            return { authors, affiliations: Array.isArray(affiliations) ? affiliations : [affiliations].filter(Boolean) };
        }
        return { authors: [], affiliations: [] };
    } catch (e) {
        console.error(`Failed to fetch full details for EID ${eid}`, e);
        return { authors: [], affiliations: [] };
    }
}

export async function fetchAuthorPublications(authorId: string, apiKey: string, yearRange: YearRange): Promise<Omit<ScopusPublication, 'author_scopus' | 'h_index'>[]> {
    let allEntries: any[] = [];
    let start = 0;
    const count = 25;
    let total = Infinity;

    while (start < total) {
        let yearQuery = '';
        if (yearRange.start || yearRange.end) {
            const startYear = yearRange.start || 1900;
            const endYear = yearRange.end || new Date().getFullYear();
            yearQuery = ` AND PUBYEAR > ${startYear - 1} AND PUBYEAR < ${endYear + 1}`;
        }
        
        const params = new URLSearchParams({
            query: `AU-ID(${authorId})${yearQuery}`,
            view: 'COMPLETE',
            count: String(count),
            start: String(start),
            sort: 'date-desc'
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`, { headers: commonHeaders(apiKey) });
        if (!response.ok) {
             const errorBody = await response.text();
             throw new Error(`Scopus search API error: ${response.status} ${response.statusText}. Response: ${errorBody}`);
        }
        
        const data = await response.json();
        const searchResults = data["search-results"];
        if (!searchResults) break;

        const entries = searchResults.entry || [];
        allEntries = allEntries.concat(entries);

        total = parseInt(searchResults["opensearch:totalResults"] || '0', 10);
        if (total === 0) break;
        
        start += entries.length;

        if (entries.length === 0) break;
    }

    const publicationPromises = allEntries.map(async (e) => {
        const eid = e["eid"];
        let publicationAuthors = e.author || [];
        let publicationAffiliations = e.affiliation || [];
        const authorCountString = e['author-count']?.$ || '0';
        const authorCount = parseInt(authorCountString, 10);

        if (eid && authorCount > 0 && authorCount > publicationAuthors.length) {
            const { authors: fullAuthors, affiliations: fullAffiliations } = await fetchFullPublicationDetails(eid, apiKey);
            if (fullAuthors.length > 0) publicationAuthors = fullAuthors;
            if (fullAffiliations.length > 0) publicationAffiliations = fullAffiliations;
        }
        
        let authorHasKnuAffilOnThisPub = false;
        const targetAuthor = publicationAuthors.find((a: any) => a.authid === authorId || a['@auid'] === authorId);

        if (targetAuthor) {
            if (targetAuthor.afid) {
                authorHasKnuAffilOnThisPub = targetAuthor.afid.some((idObj: any) => idObj.$ === KNU_AFFILIATION_ID);
            } else if (targetAuthor.affiliation) {
                const authorAffiliations = Array.isArray(targetAuthor.affiliation) ? targetAuthor.affiliation : [targetAuthor.affiliation];
                authorHasKnuAffilOnThisPub = authorAffiliations.some((aff: any) => aff && aff['@id'] === KNU_AFFILIATION_ID);
            }
        }

        const affils = publicationAffiliations;
        let has_rf = false;
        for (const aff of affils) {
            const country = String(aff["affiliation-country"] || aff["country"] || "").toLowerCase();
            if (country === "russian federation") {
                has_rf = true;
                break;
            }
        }

        return {
            eid: e["eid"] || '',
            title: e["dc:title"] || '',
            doi: e["prism:doi"] || '',
            year: e["prism:coverDate"]?.substring(0, 4) || '',
            pub_type: e["subtypeDescription"] || '',
            journal: e["prism:publicationName"] || '',
            journal_id: e["source-id"] || '',
            pages: e["prism:pageRange"] || '',
            volume: e["prism:volume"] || '',
            issue: e["prism:issueIdentifier"] || '',
            issn: e["prism:issn"] || '',
            eissn: e["prism:eIssn"] || '',
            open_access: e["openaccess"] || '',
            citedby_count: e["citedby-count"] || '',
            affil_knu: authorHasKnuAffilOnThisPub,
            affil_rf: has_rf,
        };
    });
    
    return Promise.all(publicationPromises);
}

// Function for Scopus Citation By Years Module
export async function getCitationsByYearRange(
    authorId: string, 
    startYear: number, 
    endYear: number, 
    apiKey: string,
    onProgress: (processed: number, total: number) => void
): Promise<{ data: { year: number; citations: number }[]; totalProcessed: number; apiLog: any[]; hIndex: number | string | null }> {
    
    // Fetch h-index at the beginning
    const { hIndex } = await fetchAuthorMetrics(authorId, apiKey);
    
    // 1. Fetch all publication Scopus IDs for the author
    let allScopusIds: string[] = [];
    let start = 0;
    const count = 25;
    let total = Infinity;

    while (start < total) {
        const params = new URLSearchParams({
            query: `AU-ID(${authorId})`,
            view: 'STANDARD', 
            count: String(count),
            start: String(start),
            field: 'eid,dc:identifier'
        });

        const response = await fetch(`${BASE_URL}?${params.toString()}`, { headers: commonHeaders(apiKey) });
        if (!response.ok) {
             const errorTxt = await response.text();
             throw new Error(`Scopus search failed: ${response.status} ${response.statusText} - ${errorTxt}`);
        }
        
        const data = await response.json();
        const searchResults = data["search-results"];
        if (!searchResults) break;

        const entries = searchResults.entry || [];
        const idsFromPage = entries
            .map((e: any): string | null => {
                if (typeof e['dc:identifier'] === 'string') {
                    const m = e['dc:identifier'].match(/SCOPUS_ID:(\d+)/);
                    if (m) return m[1];
                }
                if (typeof e.eid === 'string') {
                    const m = e.eid.match(/2-s2\.0-(\d+)/);
                    if (m) return m[1];
                }
                return null;
            })
            .filter((id): id is string => id !== null);

        allScopusIds = allScopusIds.concat(idsFromPage);

        total = parseInt(searchResults["opensearch:totalResults"] || '0', 10);
        if (total === 0) break;
        start += entries.length;
        if (entries.length === 0) break;
    }

    const totalPubs = allScopusIds.length;
    if (totalPubs === 0) {
        return { data: [], totalProcessed: 0, apiLog: [], hIndex };
    }

    // 2. Fetch Citation Overview in batches
    const apiLog: any[] = [];
    const citationCounts: Record<number, number> = {};
    for (let year = startYear; year <= endYear; year++) {
        citationCounts[year] = 0;
    }

    const BATCH_SIZE = 25;
    
    for (let i = 0; i < totalPubs; i += BATCH_SIZE) {
        const batchIds = allScopusIds.slice(i, i + BATCH_SIZE);
        
        onProgress(Math.min(i + BATCH_SIZE, totalPubs), totalPubs);
        
        if (batchIds.length === 0) continue;

        const params = new URLSearchParams();
        params.set('date', `${startYear}-${endYear}`);
        batchIds.forEach(id => params.append('scopus_id', id));

        const requestUrl = `${CITATION_OVERVIEW_URL}?${params.toString()}`;

        try {
            const response = await fetch(requestUrl, { headers: commonHeaders(apiKey) });
            const status = response.status;
            const responseBody = await response.clone().json().catch(() => response.clone().text());
            apiLog.push({ requestUrl, status, responseBody });
            
            if (response.ok) {
                const overview = responseBody["abstract-citations-response"];
                
                if (!overview || !overview.citeInfoMatrix?.citeInfoMatrixXML?.citationMatrix?.citeInfo) {
                    console.warn(`Citation Overview API response for batch ${i} is missing citeInfoMatrix.`, responseBody);
                    continue;
                }

                const matrix = overview.citeInfoMatrix.citeInfoMatrixXML.citationMatrix.citeInfo;
                const pubList = Array.isArray(matrix) ? matrix : [matrix];

                pubList.forEach((pub: any) => {
                    const yearlyCounts = pub.cc; // Use 'cc' for yearly counts in the date range
                    if (!yearlyCounts) return;

                    const countsArray = Array.isArray(yearlyCounts) ? yearlyCounts : [yearlyCounts];

                    countsArray.forEach((c: any, idx: number) => {
                        const year = startYear + idx;
                        const val = parseInt(c['$'], 10) || 0;
                        if (year >= startYear && year <= endYear) {
                            citationCounts[year] += val;
                        }
                    });
                });

            } else {
                 console.warn(`Citation Overview API error batch ${i}: ${response.status} ${response.statusText}`);
                 if (response.status === 401 || response.status === 403) {
                     throw new Error(`Access to Citation Overview API is denied (Status: ${response.status}). Please check your API key permissions.`);
                 }
            }
        } catch (e) {
            console.warn(`Failed to fetch Citation Overview for batch starting index ${i}`, e);
            if (e instanceof Error) apiLog.push({ requestUrl, status: 'FETCH_ERROR', error: e.message });
            // Do not rethrow, just log and continue to next batch
        }
        
        await new Promise(resolve => setTimeout(resolve, 200)); 
    }

    // 3. Format results
    const results = Object.keys(citationCounts)
        .map(yearStr => {
            const year = parseInt(yearStr);
            return { year, citations: citationCounts[year] };
        })
        .sort((a, b) => a.year - b.year);

    return { data: results, totalProcessed: totalPubs, apiLog, hIndex };
}