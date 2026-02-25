import type { PublicationMeta, EnabledMetadataServices } from '../types';
import { fetchZenodoMeta } from './zenodoService';

const CROSSREF_URL = "https://api.crossref.org/works/";
const DATACITE_URL = "https://api.datacite.org/dois/";

async function fetchFromCrossRef(doi: string): Promise<Partial<PublicationMeta>> {
    const url = `${CROSSREF_URL}${encodeURIComponent(doi)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return {};
        const data = await response.json();
        const item = data.message;
        const issnList = item.ISSN || [];
        
        const meta: Partial<PublicationMeta> = {};
        if (item.volume) meta.volume = String(item.volume);
        if (item.issue) meta.issue = String(item.issue);
        if (item.page) meta.pages = String(item.page);
        if (issnList[0]) meta.issn = issnList[0];
        if (issnList.length > 1) meta.eissn = issnList[1];
        
        return meta;

    } catch (error) {
        console.warn(`CrossRef fetch failed for DOI ${doi}:`, error);
        return {};
    }
}


async function fetchFromDataCite(doi: string): Promise<Partial<PublicationMeta>> {
    const url = `${DATACITE_URL}${encodeURIComponent(doi)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return {};
        const data = await response.json();
        const attrs = data.data.attributes;
        
        const meta: Partial<PublicationMeta> = {};
        if (attrs.volume) meta.volume = String(attrs.volume);
        if (attrs.issue) meta.issue = String(attrs.issue);
        if (attrs.container?.issn) meta.issn = attrs.container.issn;
        // pages and eissn not typically available in DataCite DOI meta
        
        return meta;
    } catch (error) {
        console.warn(`DataCite fetch failed for DOI ${doi}:`, error);
        return {};
    }
}

export async function fetchPublicationMetadata(doi: string, enabledServices: EnabledMetadataServices): Promise<PublicationMeta> {
    const cleanedDoi = doi.replace(/(https?:\/\/)?(dx\.)?doi\.org\//, '').trim();

    // Priority 1: Zenodo for Zenodo DOIs
    if (enabledServices.zenodo && cleanedDoi.startsWith('10.5281/zenodo')) {
        const zenodoMeta = await fetchZenodoMeta(cleanedDoi);
        if (Object.keys(zenodoMeta).length > 0) {
            return {
                volume: zenodoMeta.volume ?? null,
                issue: zenodoMeta.issue ?? null,
                pages: zenodoMeta.pages ?? null,
                issn: zenodoMeta.issn ?? null,
                eissn: zenodoMeta.eissn ?? null, // eISSN not likely from Zenodo
            };
        }
    }

    // Priority 2: CrossRef
    let meta: Partial<PublicationMeta> = {};
    if (enabledServices.crossref) {
        meta = await fetchFromCrossRef(cleanedDoi);
    }

    // Priority 3: DataCite (as fallback or supplement)
    const isIncomplete = !meta.volume || !meta.issue || !meta.issn;
    if (enabledServices.datacite && isIncomplete) {
        const dataciteMeta = await fetchFromDataCite(cleanedDoi);
        // Fill in the gaps, preferring existing CrossRef data
        meta.volume = meta.volume ?? dataciteMeta.volume;
        meta.issue = meta.issue ?? dataciteMeta.issue;
        meta.pages = meta.pages ?? dataciteMeta.pages; // pages not in datacite
        meta.issn = meta.issn ?? dataciteMeta.issn;
        meta.eissn = meta.eissn ?? dataciteMeta.eissn; // eissn not in datacite
    }

    return {
        volume: meta.volume ?? null,
        issue: meta.issue ?? null,
        pages: meta.pages ?? null,
        issn: meta.issn ?? null,
        eissn: meta.eissn ?? null,
    };
}