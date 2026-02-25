import type { HIndexProgress, HIndexResult, HIndexPublication } from '../types';

const BASE_URL = "https://api.elsevier.com/content/search/scopus";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const commonHeaders = (apiKey: string): Headers => {
    const headers = new Headers();
    headers.append("X-ELS-APIKey", apiKey);
    headers.append("Accept", "application/json");
    return headers;
};

export async function calculateHIndex(
    apiKey: string,
    affiliationId: string,
    onProgress: (progress: HIndexProgress) => void,
    startYearParam?: string,
    endYearParam?: string
): Promise<HIndexResult> {
    const startTime = Date.now();
    let allPublications: HIndexPublication[] = [];
    
    const year1 = parseInt(startYearParam || '', 10) || new Date().getFullYear();
    const year2 = parseInt(endYearParam || '', 10) || 1900;
    
    // Ensure loop runs from higher year to lower year regardless of input order
    const loopStartYear = Math.max(year1, year2);
    const loopEndYear = Math.min(year1, year2);
    
    const totalYears = loopStartYear - loopEndYear + 1;

    for (let year = loopStartYear; year >= loopEndYear; year--) {
        onProgress({
            currentYear: year,
            totalYears: totalYears,
            publicationsFetchedThisYear: 0,
            totalPublicationsFetched: allPublications.length,
            message: `Scanning year ${year}...`
        });

        let start = 0;
        const count = 200;
        let totalResultsForYear = -1;
        let fetchedThisYear = 0;

        while (totalResultsForYear === -1 || start < totalResultsForYear) {
            const params = new URLSearchParams({
                query: `AF-ID(${affiliationId}) AND PUBYEAR IS ${year}`,
                field: 'citedby-count,dc:title,prism:doi,prism:coverDate,load-date',
                count: String(count),
                start: String(start),
            });
            
            await sleep(100); // Politeness delay

            const response = await fetch(`${BASE_URL}?${params.toString()}`, { headers: commonHeaders(apiKey) });
            
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Scopus API error for year ${year}: ${response.status} ${response.statusText}. Response: ${errorBody}`);
            }

            const data = await response.json();
            const searchResults = data["search-results"];
            if (!searchResults) break;
            
            totalResultsForYear = parseInt(searchResults["opensearch:totalResults"] || '0', 10);
            
            const entries = searchResults.entry || [];
            if (entries.length > 0) {
                const publications: HIndexPublication[] = entries
                    .map((e: any) => ({
                        title: e['dc:title'] || '',
                        doi: e['prism:doi'] || '',
                        citedby_count: parseInt(e["citedby-count"] || '0', 10),
                        publication_date: e["prism:coverDate"]?.substring(0, 10) || '',
                        indexing_date: e["load-date"] ? new Date(e["load-date"]).toISOString().split('T')[0] : ''
                    }))
                    .filter((p: HIndexPublication) => !isNaN(p.citedby_count));
                allPublications.push(...publications);
                fetchedThisYear += publications.length;
            }

            onProgress({
                currentYear: year,
                totalYears: totalYears,
                publicationsFetchedThisYear: fetchedThisYear,
                totalPublicationsFetched: allPublications.length,
                message: `Found ${fetchedThisYear} publications for ${year}. Total so far: ${allPublications.length}`
            });
            
            start += entries.length;
            if (entries.length === 0 || totalResultsForYear === 0) break;
        }
    }
    
    onProgress({
        currentYear: loopEndYear - 1,
        totalYears: totalYears,
        publicationsFetchedThisYear: 0,
        totalPublicationsFetched: allPublications.length,
        message: 'All publications fetched. Calculating h-index...'
    });

    // Sort for H-Index calculation and export
    allPublications.sort((a, b) => b.citedby_count - a.citedby_count);

    let hIndex = 0;
    for (let i = 0; i < allPublications.length; i++) {
        if (allPublications[i].citedby_count >= i + 1) {
            hIndex = i + 1;
        } else {
            break;
        }
    }

    const endTime = Date.now();
    const calculationTime = (endTime - startTime) / 1000;

    return {
        hIndex: hIndex,
        totalPublications: allPublications.length,
        calculationTime: parseFloat(calculationTime.toFixed(2)),
        publications: allPublications,
    };
}