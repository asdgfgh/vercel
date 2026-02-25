import type { ParsedPublicationData, Author } from '../types';

function cleanAbstract(abstract?: string): string | undefined {
    if (!abstract) return undefined;
    return abstract.replace(/<\/?jats:p>/g, '').trim();
}

function normalizeCrossref(data: any): ParsedPublicationData {
    const item = data.message;
    const authors: Author[] = (item.author || []).map((a: any) => ({
        name: `${a.given} ${a.family}`.trim(),
        orcid: a.ORCID ? a.ORCID.match(/[^/]+$/)?.[0] : undefined,
        affiliation: (a.affiliation || []).map((aff: any) => aff.name).join(', '),
    }));

    const publicationDateParts = item.issued?.['date-parts']?.[0];
    const publicationDate = publicationDateParts ? publicationDateParts.join('-') : undefined;

    return {
        title: (item.title || [])[0],
        authors,
        journalName: (item['container-title'] || [])[0],
        publicationDate,
        volume: item.volume,
        issue: item.issue,
        pages: item.page,
        doi: item.DOI,
        abstract: cleanAbstract(item.abstract),
        keywords: item.subject || [],
        pdfUrl: item.link?.find((l: any) => l['content-type'] === 'application/pdf')?.URL,
    };
}

function normalizeDataCite(data: any): ParsedPublicationData {
    const attrs = data.data.attributes;
    const authors: Author[] = (attrs.creators || []).map((c: any) => ({
        name: c.name,
        orcid: c.nameIdentifiers?.find((ni: any) => ni.nameIdentifierScheme === 'ORCID')?.nameIdentifier,
        affiliation: (c.affiliation || []).map((aff: any) => aff.name).join(', '),
    }));

    return {
        title: (attrs.titles || [])[0]?.title,
        authors,
        journalName: attrs.container?.title,
        publicationDate: attrs.publicationYear?.toString(),
        volume: attrs.volume,
        issue: attrs.issue,
        pages: undefined,
        doi: attrs.doi,
        abstract: attrs.descriptions?.find((d: any) => d.descriptionType === 'Abstract')?.description,
        keywords: attrs.subjects?.map((s: any) => s.subject) || [],
        pdfUrl: undefined,
    };
}

export async function fetchMetadataByDoi(doi: string): Promise<ParsedPublicationData> {
    const cleanedDoi = doi.replace(/(https?:\/\/)?(dx\.)?doi\.org\//, '').trim();
    const encodedDoi = encodeURIComponent(cleanedDoi);

    try {
        const crossrefResponse = await fetch(`https://api.crossref.org/works/${encodedDoi}`);
        if (crossrefResponse.ok) {
            const data = await crossrefResponse.json();
            return normalizeCrossref(data);
        }
    } catch (e) {
        console.warn("Crossref API call failed:", e);
    }

    try {
        const dataciteResponse = await fetch(`https://api.datacite.org/dois/${encodedDoi}`);
        if (dataciteResponse.ok) {
            const data = await dataciteResponse.json();
            return normalizeDataCite(data);
        } else if (dataciteResponse.status === 404) {
             throw new Error(`DOI "${cleanedDoi}" не знайдено в Crossref або DataCite.`);
        } else {
            throw new Error(`Помилка DataCite API: ${dataciteResponse.status} ${dataciteResponse.statusText}`);
        }
    } catch (error) {
         console.error("Error fetching from DataCite:", error);
         if (error instanceof Error) {
            throw new Error(`Не вдалося отримати метадані для DOI: ${error.message}`);
         }
    }
    
    throw new Error(`Не вдалося отримати метадані для DOI "${cleanedDoi}" з жодного джерела.`);
}
