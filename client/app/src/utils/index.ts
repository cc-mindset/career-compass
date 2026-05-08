
// Normalize text for better search matching
export const normalizeText = (text: string) =>
    text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim(); // removes leading/trailing spaces