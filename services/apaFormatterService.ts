import type { ParsedPublicationData, Author } from '../types';

function toSentenceCase(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatAuthors(authors: Author[]): string {
    if (!authors || authors.length === 0) return '';

    const formatName = (name: string) => {
        const parts = name.split(',').map(p => p.trim());
        if (parts.length > 1) { // "Last, First M."
            const lastName = parts[0];
            const firstNames = parts[1].split(/\s+/).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
            return `${lastName}, ${firstNames}`;
        }
        const nameParts = name.split(/\s+/);
        const lastName = nameParts.pop() || '';
        const initials = nameParts.map(n => n.charAt(0).toUpperCase() + '.').join(' ');
        return `${lastName}, ${initials}`;
    };

    const formattedNames = authors.map(a => formatName(a.name));
    
    if (formattedNames.length === 1) {
        return formattedNames[0];
    }
    if (formattedNames.length <= 20) {
        const lastAuthor = formattedNames.pop();
        return `${formattedNames.join(', ')} & ${lastAuthor}`;
    }
    // 21+ authors
    const first19 = formattedNames.slice(0, 19);
    const lastAuthor = formattedNames[formattedNames.length - 1];
    return `${first19.join(', ')}, ... ${lastAuthor}`;
}

export function formatApa7Citation(data: ParsedPublicationData): string {
    const parts: string[] = [];

    const authorStr = formatAuthors(data.authors);
    if (authorStr) parts.push(authorStr);

    if (data.publicationDate) {
        const yearMatch = data.publicationDate.match(/\d{4}/);
        if (yearMatch) {
            parts.push(`(${yearMatch[0]}).`);
        }
    }
    
    if (data.title) {
        parts.push(`${toSentenceCase(data.title)}.`);
    }

    const sourceParts: string[] = [];
    if (data.journalName) {
        sourceParts.push(`*${data.journalName}*`);
    }

    if (data.volume) {
        sourceParts.push(`, *${data.volume}*`);
    }

    if (data.issue) {
        sourceParts.push(`(${data.issue})`);
    }
    
    if (data.pages) {
        sourceParts.push(`, ${data.pages}`);
    }
    
    if (sourceParts.length > 0) {
        parts.push(sourceParts.join('') + '.');
    }
    
    if (data.doi) {
        const cleanedDoi = data.doi.replace(/(https?:\/\/)?(dx\.)?doi\.org\//, '');
        parts.push(`https://doi.org/${cleanedDoi}`);
    }

    return parts.join(' ');
}
