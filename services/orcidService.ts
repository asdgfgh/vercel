import { fetchPublicationMetadata } from './metadataService';
import type { OrcidWork, YearRange, EnabledMetadataServices } from '../types';

const ORCID_URL = "https://pub.orcid.org/v3.0/";

const ns = {
    activities: "http://www.orcid.org/ns/activities",
    common: "http://www.orcid.org/ns/common",
    work: "http://www.orcid.org/ns/work",
};

const normalizeDoi = (doi: string | null | undefined): string | null => {
    if (!doi) return null;
    return doi.toLowerCase().replace("https://doi.org/", "").trim();
};

const normalizeTitle = (title: string | null | undefined): string => {
    if (!title) return "";
    return title.toLowerCase().trim();
};

const getTextContent = (element: Element | null, tagName: string, namespace: string): string | null => {
    const child = element?.getElementsByTagNameNS(namespace, tagName)?.[0];
    return child?.textContent || null;
};

export async function fetchAndProcessOrcidWorks(orcidId: string, yearRange: YearRange, enabledServices: EnabledMetadataServices): Promise<OrcidWork[]> {
    const url = `${ORCID_URL}${orcidId}/works`;
    const response = await fetch(url, { headers: { "Accept": "application/xml" } });

    if (!response.ok) {
        throw new Error(`ORCID API error for ${orcidId}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    
    const workSummaries = xmlDoc.getElementsByTagNameNS(ns.work, 'work-summary');
    
    const works: (Omit<OrcidWork, 'author_name'> & { title_norm: string })[] = [];

    for (const summary of Array.from(workSummaries)) {
        const yearEl = summary.getElementsByTagNameNS(ns.common, 'year')?.[0];
        const year = yearEl?.textContent || null;
        
        if (year) {
             const yearNum = parseInt(year);
             if (yearRange.start && yearNum < yearRange.start) continue;
             if (yearRange.end && yearNum > yearRange.end) continue;
        }

        const title = getTextContent(summary.getElementsByTagNameNS(ns.work, 'title')[0], 'title', ns.common);
        const journal = getTextContent(summary, 'journal-title', ns.work);
        const work_type = getTextContent(summary, 'type', ns.work);

        let doi: string | null = null;
        const externalIds = summary.getElementsByTagNameNS(ns.common, 'external-id');
        for (const eid of Array.from(externalIds)) {
            if (getTextContent(eid, 'external-id-type', ns.common)?.toLowerCase() === 'doi') {
                doi = getTextContent(eid, 'external-id-value', ns.common);
                break;
            }
        }
        
        const putCode = summary.getAttribute('put-code');
        
        let source = "Other";
        const sourceEl = summary.getElementsByTagNameNS(ns.common, 'source')?.[0];
        if (sourceEl) {
            if (sourceEl.getElementsByTagNameNS(ns.common, 'source-orcid')?.length > 0) {
                source = "author";
            } else {
                source = getTextContent(sourceEl, 'source-name', ns.common) || "Other";
            }
        }
        if (["Crossref", "DataCite"].includes(source)) {
            source = "Other";
        }
        
        const normalizedDoi = normalizeDoi(doi);
        let publicationMeta = { volume: null, issue: null, pages: null, issn: null, eissn: null };
        if (normalizedDoi) {
            publicationMeta = await fetchPublicationMetadata(normalizedDoi, enabledServices);
        }

        works.push({
            orcid: orcidId,
            title: title || 'N/A',
            title_norm: normalizeTitle(title),
            journal: journal,
            year: year,
            doi: normalizedDoi,
            sours: source,
            type: work_type,
            put_code: putCode,
            ...publicationMeta,
        });
    }

    return works.map(({ title_norm: _title_norm, ...rest }) => rest);
}