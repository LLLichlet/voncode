import * as vscode from 'vscode';
import { brightnessToChar, rgbToBrightness, rgbToHex } from './charmaps';

const FONT_ASPECT = 0.6;

function sampleRegion(
    frame: Buffer, srcW: number, srcH: number,
    x0: number, y0: number, x1: number, y1: number,
): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0, count = 0;

    const startX = Math.max(0, Math.floor(x0));
    const endX = Math.min(srcW, Math.ceil(x1));
    const startY = Math.max(0, Math.floor(y0));
    const endY = Math.min(srcH, Math.ceil(y1));

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const offset = (y * srcW + x) * 3;
            r += frame[offset];
            g += frame[offset + 1];
            b += frame[offset + 2];
            count++;
        }
    }

    if (count === 0) { return { r: 0, g: 0, b: 0 }; }
    return {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
    };
}

export function renderFrame(
    frame: Buffer,
    srcW: number,
    srcH: number,
    cols: number,
    rows: number,
): vscode.DecorationOptions[] {
    const cellW = srcW / cols;
    const cellH = cellW / FONT_ASPECT;
    const decorations: vscode.DecorationOptions[] = [];

    for (let row = 0; row < rows; row++) {
        const y0 = row * cellH;
        const y1 = y0 + cellH;

        for (let col = 0; col < cols; col++) {
            const x0 = col * cellW;
            const x1 = x0 + cellW;

            const { r, g, b } = sampleRegion(frame, srcW, srcH, x0, y0, x1, y1);
            const ch = brightnessToChar(rgbToBrightness(r, g, b));
            const color = rgbToHex(r, g, b);

            const pos = new vscode.Position(row, col);
            decorations.push({
                range: new vscode.Range(pos, pos.translate(0, 1)),
                renderOptions: {
                    before: {
                        contentText: ch,
                        color,
                        fontWeight: 'bold',
                    },
                },
            });
        }
    }

    return decorations;
}
