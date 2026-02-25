import type { OpenAlexPublication, OpenAlexWorkType, YearRange } from '../types';

const API_BASE_URL = "https://api.openalex.org";
const ROR_ID = "02aaqv166";
const ROR_URL = `https://ror.org/${ROR_ID}`;

const mapOpenAlexRecord = (item: any): OpenAlexPublication => {
    const knuAuthorsOrcid = item.authorships
        .filter((a: any) => 
            a.institutions.some((inst: any) => inst.ror === ROR_URL)
        )
        .map((a: any) => a.author.orcid)
        .filter(Boolean)
        .map((orcid_url: string) => orcid_url.replace("https://orcid.org/", ""))
        .join('; ');

    return {
        id: item.id,
        doi: item.doi,
        title: item.display_name,
        publication_year: item.publication_year,
        type: item.type,
        authors: item.authorships.map((a: any) => a.author.display_name).join('; '),
        journal: item.primary_location?.source?.display_name || 'N/A',
        cited_by_count: item.cited_by_count,
        open_access_status: item.open_access?.oa_status || 'unknown',
        url: item.best_oa_location?.landing_page_url || item.primary_location?.landing_page_url || (item.doi ? `https://doi.org/${item.doi}` : item.id),
        knu_authors_orcid: knuAuthorsOrcid || '',
    };
};


export async function fetchWorkTypes(): Promise<OpenAlexWorkType[]> {
    const response = await fetch(`${API_BASE_URL}/types`);
    if (!response.ok) {
        throw new Error('Failed to fetch OpenAlex work types');
    }
    const data = await response.json();
    return data.results.map((type: any) => ({
        id: type.id,
        display_name: type.display_name
    }));
}

export async function fetchOpenAlexPublications(
    yearRange: YearRange,
    selectedTypes: string[],
    onProgress: (page: number, total: number | null) => void
): Promise<OpenAlexPublication[]> {
    let allPublications: OpenAlexPublication[] = [];
    let cursor: string | null = "*";
    let page = 0;
    let total: number | null = null;
    let totalPages: number | null = null;
    
    const filters = [`authorships.institutions.ror:${ROR_ID}`];
    
    if (yearRange.start || yearRange.end) {
        const start = (yearRange.start && !isNaN(yearRange.start)) ? yearRange.start : '';
        const end = (yearRange.end && !isNaN(yearRange.end)) ? yearRange.end : '';
        if (start || end) {
            filters.push(`publication_year:${start}-${end}`);
        }
    }

    if (selectedTypes.length > 0) {
        const typeIds = selectedTypes.map(typeUrl => typeUrl.split('/').pop() || '');
        const valid_ids = typeIds.filter(Boolean);
        if (valid_ids.length > 0) {
            filters.push(`type:${valid_ids.join('|')}`);
        }
    }

    while (cursor) {
        page++;
        const params = new URLSearchParams({
            filter: filters.join(','),
            "per_page": "200",
            cursor: cursor,
        });

        const response = await fetch(`${API_BASE_URL}/works?${params.toString()}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}. Response: ${errorBody}`);
        }

        const data = await response.json();
        
        if (page === 1 && data.meta.count) {
            total = data.meta.count;
            totalPages = Math.ceil(total / 200);
        }
        
        onProgress(page, totalPages);

        const publications = data.results.map(mapOpenAlexRecord);
        allPublications.push(...publications);

        cursor = data.meta.next_cursor;
        
        // Rate limiting to be polite to the API
        if (cursor) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return allPublications;
}