const CHAR_GRADIENT = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export function brightnessToChar(b: number): string {
    const idx = Math.floor((b / 255) * (CHAR_GRADIENT.length - 1));
    return CHAR_GRADIENT[Math.max(0, Math.min(idx, CHAR_GRADIENT.length - 1))];
}

export function rgbToBrightness(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function rgbToHex(r: number, g: number, b: number): string {
    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    return `#${hex}`;
}
