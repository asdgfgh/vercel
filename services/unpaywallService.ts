export async function checkDoiAccess(doi: string, email: string): Promise<{ status: string; pdf_url: string | null }> {
    if (!doi || !doi.trim()) {
        return { status: 'Unknown', pdf_url: null };
    }
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi.trim())}?email=${encodeURIComponent(email)}`;

    try {
        const response = await fetch(url);
        if (response.status === 404) {
            return { status: 'DOI not found', pdf_url: null };
        }
        if (!response.ok) {
            console.error(`Unpaywall API error for DOI ${doi}: ${response.status} ${response.statusText}`);
            const statusText = response.statusText ? ` (${response.statusText})` : '';
            return { status: `API Error ${response.status}${statusText}`, pdf_url: null };
        }

        const data = await response.json();
        
        let status = 'Unknown';
        if (data.is_oa) {
            status = data.oa_status ? `Open Access (${data.oa_status})` : 'Open Access';
        } else if (data.is_oa === false) {
            status = 'Closed';
        }
        
        const pdf_url = data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || null;
        
        return { status, pdf_url };
    } catch (error) {
        console.error(`Failed to fetch from Unpaywall for DOI ${doi}:`, error);
        return { status: 'Network Error', pdf_url: null };
    }
}
