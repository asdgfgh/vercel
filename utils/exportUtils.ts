
declare const XLSX: any;

export function exportArrayToXlsx(data: any[][], filename: string = 'export.xlsx') {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processed Data');

    if (data.length > 0 && data[0].length > 0) {
        const colWidths = data[0].map((_, i) => {
            const columnData = data.map(row => String(row[i] || ''));
            const maxLength = Math.max(...columnData.map(val => val.length));
            const width = Math.min(Math.max(10, maxLength) + 2, 80);
            return { wch: width };
        });
        worksheet['!cols'] = colWidths;
    }

    XLSX.writeFile(workbook, filename);
}

export function exportObjectsToXlsx(data: object[], filename: string = 'export.xlsx') {
    if (data.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Statistics");

    // Auto-calculate column widths
    if (data.length > 0) {
        const header = Object.keys(data[0]);
        const colWidths = header.map(key => ({
            wch: Math.max(
                key.length,
                ...data.map(row => String((row as any)[key] ?? '').length)
            ) + 2
        }));
        worksheet['!cols'] = colWidths;
    }
    
    XLSX.writeFile(workbook, filename);
}


export function exportMultipleTablesToSingleXlsx(sheets: {title: string, data: any[]}[], filename: string) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]); 

    let currentRow = 0;
    const allHeaders = new Set<string>();

    sheets.forEach(sheet => {
        if (sheet.data.length > 0) {
            Object.keys(sheet.data[0]).forEach(h => allHeaders.add(h));
        }
    });

    sheets.forEach(sheet => {
        if (sheet.data && sheet.data.length > 0) {
            XLSX.utils.sheet_add_aoa(ws, [[sheet.title]], { origin: { r: currentRow, c: 0 } });
            currentRow += 2;
            
            XLSX.utils.sheet_add_json(ws, sheet.data, { origin: { r: currentRow, c: 0 } });
            currentRow += sheet.data.length + 3;
        }
    });
    
    const dataForWidthCalc = sheets.flatMap(s => s.data);
    if (dataForWidthCalc.length > 0) {
        const colWidths = Array.from(allHeaders).map(header => {
            return {
                wch: Math.max(
                    header.length,
                    ...dataForWidthCalc.map(row => String((row as any)[header] ?? '').length)
                ) + 2
            };
        });
         ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Statistics Report");
    XLSX.writeFile(wb, filename);
}
