
export async function fetchHtmlContent(url: string): Promise<string> {
    // Using a different proxy since corsproxy.io is unstable.
    // 'api.allorigins.win' returns JSON with a 'contents' field.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`Помилка мережі: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        return html;

    } catch (error) {
        console.error("Error fetching HTML content:", error);
        if (error instanceof Error) {
            throw new Error(`Не вдалося завантажити HTML: ${error.message}. Спробуйте інший сайт, перевірте URL або переконайтеся, що сайт доступний.`);
        }
        throw new Error("Невідома помилка під час завантаження HTML.");
    }
}
