import type { ParsedPublicationData, Author } from '../types';

function getMetaContent(doc: Document, name: string): string | undefined {
    return doc.querySelector<HTMLMetaElement>(`meta[name='${name}']`)?.content.trim();
}

function getAllMetaContents(doc: Document, name: string): string[] {
    return Array.from(doc.querySelectorAll<HTMLMetaElement>(`meta[name='${name}']`)).map(meta => meta.content.trim());
}

function getJsonLd(doc: Document): any | null {
    try {
        const script = doc.querySelector('script[type="application/ld+json"]');
        if (script && script.textContent) {
            const data = JSON.parse(script.textContent);
            if (Array.isArray(data)) return data.find(item => item['@type'] === 'ScholarlyArticle') || data[0];
            if (data['@graph'] && Array.isArray(data['@graph'])) return data['@graph'].find(item => item['@type'] === 'ScholarlyArticle') || data['@graph'][0];
            return data;
        }
    } catch (e) {
        console.warn("Could not parse JSON-LD", e);
    }
    return null;
}


export function parseHtmlForMetadata(html: string): ParsedPublicationData {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const jsonLd = getJsonLd(doc);

    const authors: Author[] = [];
    const authorNames = getAllMetaContents(doc, 'citation_author');
    const affiliations = getAllMetaContents(doc, 'citation_author_institution');
    const orcids = getAllMetaContents(doc, 'citation_author_orcid');

    if (authorNames.length > 0) {
        authorNames.forEach((name, index) => {
            authors.push({
                name,
                affiliation: affiliations[index],
                orcid: orcids[index]
            });
        });
    } else if (jsonLd?.author) {
         (Array.isArray(jsonLd.author) ? jsonLd.author : [jsonLd.author]).forEach((author: any) => {
             if (typeof author === 'string') {
                 authors.push({ name: author });
             } else if (typeof author === 'object') {
                 authors.push({
                     name: author.name,
                     affiliation: author.affiliation?.name,
                     orcid: author.sameAs
                 });
             }
         });
    }

    const keywords = getAllMetaContents(doc, 'citation_keywords').flatMap(k => k.split(/,; /).map(kw => kw.trim()).filter(Boolean));
    if (keywords.length === 0 && jsonLd?.keywords) {
        keywords.push(...(typeof jsonLd.keywords === 'string' ? jsonLd.keywords.split(/, |; /) : jsonLd.keywords));
    }

    const pages = [getMetaContent(doc, 'citation_firstpage'), getMetaContent(doc, 'citation_lastpage')].filter(Boolean).join('–');

    const publicationDate =
        jsonLd?.datePublished ||
        getMetaContent(doc, 'citation_publication_date') ||
        getMetaContent(doc, 'citation_date') ||
        getMetaContent(doc, 'DC.Date') ||
        getMetaContent(doc, 'DC.Date.created') ||
        getMetaContent(doc, 'DC.date.issued') ||
        doc.querySelector('.published .value')?.textContent?.trim() ||
        doc.querySelector('.date-published')?.textContent?.trim();


    return {
        title: jsonLd?.headline || getMetaContent(doc, 'citation_title') || doc.querySelector('h1')?.textContent?.trim(),
        authors,
        journalName: jsonLd?.isPartOf?.name || getMetaContent(doc, 'citation_journal_title'),
        publicationDate,
        volume: jsonLd?.isPartOf?.volumeNumber || getMetaContent(doc, 'citation_volume'),
        issue: jsonLd?.isPartOf?.issueNumber || getMetaContent(doc, 'citation_issue'),
        pages: jsonLd?.pageStart && jsonLd?.pageEnd ? `${jsonLd.pageStart}–${jsonLd.pageEnd}` : pages,
        doi: jsonLd?.identifier?.value || jsonLd?.doi || getMetaContent(doc, 'citation_doi'),
        abstract: jsonLd?.description || getMetaContent(doc, 'DC.Description') || getMetaContent(doc, 'description'),
        keywords: [...new Set(keywords)],
        pdfUrl: jsonLd?.associatedMedia?.contentUrl || getMetaContent(doc, 'citation_pdf_url'),
        apaCitation: undefined,
    };
}
