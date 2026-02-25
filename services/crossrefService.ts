
const CROSSREF_URL = "https://api.crossref.org/works/";

interface CrossRefMeta {
    volume: string | null;
    issue: string | null;
    pages: string | null;
    issn: string | null;
    eissn: string | null;
}

export async function fetchCrossRefMeta(doi: string): Promise<CrossRefMeta> {
    const url = `${CROSSREF_URL}${encodeURIComponent(doi)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`CrossRef fetch failed for DOI ${doi}: ${response.statusText}`);
            return { volume: null, issue: null, pages: null, issn: null, eissn: null };
        }
        const data = await response.json();
        const item = data.message;
        
        const issnList = item.ISSN || [];
        
        return {
            volume: item.volume || null,
            issue: item.issue || null,
            pages: item.page || null,
            issn: issnList[0] || null,
            eissn: issnList.length > 1 ? issnList[1] : null,
        };
    } catch (error) {
        console.error(`Error fetching from CrossRef for DOI ${doi}:`, error);
        return { volume: null, issue: null, pages: null, issn: null, eissn: null };
    }
}
