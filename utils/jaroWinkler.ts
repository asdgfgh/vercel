// Implementation of Jaro-Winkler string similarity algorithm
// Based on the description from Wikipedia and other sources.

export function jaroWinkler(s1: string, s2: string, p: number = 0.1): number {
    let m = 0;

    // Exit early if either string is empty.
    if (s1.length === 0 || s2.length === 0) {
        return 0;
    }

    // Ensure s1 is the shorter string.
    if (s1.length > s2.length) {
        [s1, s2] = [s2, s1];
    }

    const max_dist = Math.floor(s2.length / 2) - 1;
    const s1_matches = new Array(s1.length).fill(false);
    const s2_matches = new Array(s2.length).fill(false);

    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - max_dist);
        const end = Math.min(i + max_dist + 1, s2.length);

        for (let j = start; j < end; j++) {
            if (!s2_matches[j] && s1[i] === s2[j]) {
                s1_matches[i] = true;
                s2_matches[j] = true;
                m++;
                break;
            }
        }
    }

    if (m === 0) {
        return 0;
    }

    let t = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (s1_matches[i]) {
            while (!s2_matches[k]) {
                k++;
            }
            if (s1[i] !== s2[k]) {
                t++;
            }
            k++;
        }
    }

    const jaro_dist = (m / s1.length + m / s2.length + (m - t / 2) / m) / 3;

    // Winkler bonus
    let l = 0;
    const limit = Math.min(4, s1.length, s2.length);
    while (l < limit && s1[l] === s2[l]) {
        l++;
    }

    return jaro_dist + l * p * (1 - jaro_dist);
}

export const normalizeTitleForComparison = (title: string | null | undefined): string => {
    if (!title) return "";

    let normalized = title.toLowerCase().trim();

    // 1. Transliteration of special characters
    const translitMap: { [key: string]: string } = {
        'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'ζ': 'zeta',
        'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu',
        'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron', 'π': 'pi', 'ρ': 'rho', 'σ': 'sigma',
        'τ': 'tau', 'υ': 'upsilon', 'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
        'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss', 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a',
        'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i', 'î': 'i',
        'ï': 'i', 'ð': 'd', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ù': 'u',
        'ú': 'u', 'û': 'u', 'ý': 'y', 'þ': 'th', 'ÿ': 'y', 'ø': 'o', 'ł': 'l', 'ś': 's',
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ń': 'n', 'ź': 'z', 'ż': 'z'
    };
    const translitRegex = new RegExp(Object.keys(translitMap).join('|'), 'g');
    normalized = normalized.replace(translitRegex, (match) => translitMap[match]);


    // 2. Roman numeral conversion
    const romanToArabic: { [key: string]: number } = {
        'xx': 20, 'xix': 19, 'xviii': 18, 'xvii': 17, 'xvi': 16, 'xv': 15, 'xiv': 14, 'xiii': 13, 'xii': 12, 'xi': 11, 'x': 10,
        'ix': 9, 'viii': 8, 'vii': 7, 'vi': 6, 'v': 5, 'iv': 4, 'iii': 3, 'ii': 2, 'i': 1
    };
    const romanNumeralRegex = new RegExp(`\\b(${Object.keys(romanToArabic).join('|')})\\b`, 'g');
    normalized = normalized.replace(romanNumeralRegex, match => ` roman${romanToArabic[match]} `);

    // 3. Final cleanup: remove non-alphanumeric chars (but keep letters of any language) and extra spaces
    normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    
    return normalized;
};