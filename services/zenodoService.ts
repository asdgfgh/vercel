
import type { PublicationMeta } from '../types';

const ZENODO_API_URL = "https://zenodo.org/api/records/";

export async function fetchZenodoMeta(doi: string): Promise<Partial<PublicationMeta>> {
    const recordId = doi.split('zenodo.')[1];
    if (!recordId) {
        console.warn(`Could not extract Zenodo record ID from DOI: ${doi}`);
        return {};
    }

    // Direct request to Zenodo API (CORS supported)
    const url = `${ZENODO_API_URL}${recordId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Zenodo fetch failed for record ID ${recordId}: ${response.statusText}`);
            return {};
        }
        const data = await response.json();
        const journal = data.metadata?.journal;
        
        const meta: Partial<PublicationMeta> = {};

        if (journal?.volume) meta.volume = String(journal.volume);
        if (journal?.issue) meta.issue = String(journal.issue);
        if (journal?.pages) meta.pages = String(journal.pages);
        if (journal?.issn) meta.issn = String(journal.issn);

        return meta;

    } catch (error) {
        console.error(`Error fetching from Zenodo for record ID ${recordId}:`, error);
        return {};
    }
}
