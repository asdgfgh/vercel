import { fetchMetadataByDoi } from './apaDoiService';
import { fetchHtmlContent } from './htmlService';
import { parseHtmlForMetadata } from './htmlParserService';
import { formatApa7Citation } from './apaFormatterService';
import type { ParsedPublicationData } from '../types';

interface ProcessResult {
    data: ParsedPublicationData;
    apaCitation: string;
}

export async function processIdentifier(identifier: string): Promise<ProcessResult> {
    let data: ParsedPublicationData;
    const cleanedIdentifier = identifier.trim();
    
    if (!cleanedIdentifier) {
        throw new Error("Ідентифікатор не може бути порожнім.");
    }

    let isUrl = false;
    try {
        new URL(cleanedIdentifier);
        isUrl = true;
    } catch (_) {
        isUrl = false;
    }

    const isDoi = /^(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i.test(cleanedIdentifier) || cleanedIdentifier.toLowerCase().includes('doi.org');
    
    if (isDoi) {
        data = await fetchMetadataByDoi(cleanedIdentifier);
    } else if (isUrl) {
        const html = await fetchHtmlContent(cleanedIdentifier);
        data = parseHtmlForMetadata(html);
    } else {
        throw new Error(`Не вдалося розпізнати '${cleanedIdentifier}' як валідний URL або DOI.`);
    }
    
    const apaCitation = formatApa7Citation(data);
    
    return { data, apaCitation };
}
