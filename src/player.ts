import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { probe, FrameDecoder } from './decoder';
import { renderFrame } from './render';

export class Player {
    private decoType: vscode.TextEditorDecorationType;
    private decoder: FrameDecoder | null = null;
    private editor: vscode.TextEditor | null = null;
    private canvasUri: vscode.Uri | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private rows: number = 0;
    private cols: number = 0;

    constructor() {
        this.decoType = vscode.window.createTextEditorDecorationType({});
    }

    async play(videoPath: string, fps: number = 5): Promise<void> {
        this.stop();

        const srcEditor = vscode.window.activeTextEditor;
        if (!srcEditor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        // create a generous canvas first, then measure from it
        const canvasPath = path.join(os.tmpdir(), `voncode-cam-${Date.now()}.txt`);
        this.canvasUri = vscode.Uri.file(canvasPath);
        const padLines: string[] = [];
        for (let i = 0; i < 200; i++) {
            padLines.push(' '.repeat(200));
        }
        await vscode.workspace.fs.writeFile(this.canvasUri, Buffer.from(padLines.join('\n'), 'utf-8'));

        const doc = await vscode.workspace.openTextDocument(this.canvasUri);
        this.editor = await vscode.window.showTextDocument(doc, {
            viewColumn: srcEditor.viewColumn,
            preview: false,
        });

        // measure viewport from the canvas
        const visibleRanges = this.editor.visibleRanges;
        if (visibleRanges.length === 0) {
            vscode.window.showErrorMessage('Cannot determine visible area.');
            return;
        }

        const firstLine = visibleRanges[0].start.line;
        const lastLine = visibleRanges[visibleRanges.length - 1].end.line;
        this.rows = lastLine - firstLine + 1;
        this.cols = Math.floor(
            (visibleRanges[0].end.character - visibleRanges[0].start.character) / 2,
        );

        if (this.cols < 1 || this.rows < 1) {
            vscode.window.showErrorMessage('Visible area too small.');
            return;
        }

        // resize canvas to exact dimensions
        const exactLines: string[] = [];
        for (let i = 0; i < this.rows; i++) {
            exactLines.push(' '.repeat(this.cols));
        }
        await vscode.workspace.fs.writeFile(this.canvasUri, Buffer.from(exactLines.join('\n'), 'utf-8'));

        const videoInfo = await probe(videoPath);

        // decode at ~2x render res for detail
        const scale = Math.max(
            videoInfo.width / (this.cols * 2),
            videoInfo.height / (this.rows * 2),
        );
        const decodeW = Math.round(videoInfo.width / scale);
        const decodeH = Math.round(videoInfo.height / scale);

        this.decoder = new FrameDecoder(videoPath, fps, decodeW, decodeH);

        const intervalMs = Math.round(1000 / fps);
        this.timer = setInterval(() => this.tick(), intervalMs);
    }

    private tick(): void {
        if (!this.decoder || !this.editor) { return; }

        if (!this.decoder.isAlive()) {
            const err = this.decoder.lastError();
            this.stop();
            const msg = err
                ? `ffmpeg exited: ${err}`
                : 'ffmpeg exited unexpectedly with no error output.';
            vscode.window.showErrorMessage(msg);
            return;
        }

        let lastFrame: Buffer | null = null;
        while (this.decoder.hasFrame()) {
            const f = this.decoder.readFrame();
            if (f) { lastFrame = f; }
        }

        if (lastFrame) {
            const decorations = renderFrame(
                lastFrame, this.decoder.width, this.decoder.height, this.cols, this.rows,
            );
            this.editor.setDecorations(this.decoType, decorations);
        }
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.decoder) {
            this.decoder.dispose();
            this.decoder = null;
        }
        if (this.editor) {
            this.editor.setDecorations(this.decoType, []);
        }
        if (this.canvasUri) {
            vscode.workspace.fs.delete(this.canvasUri, { useTrash: false }).then(
                () => {}, () => {},
            );
            this.canvasUri = null;
        }
        this.editor = null;
    }

    dispose(): void {
        this.stop();
        this.decoType.dispose();
    }
}
