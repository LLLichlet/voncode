import { spawn, ChildProcess, execSync } from 'child_process';

export function checkFfmpeg(): boolean {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        execSync('ffprobe -version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

export interface VideoInfo {
    width: number;
    height: number;
}

export async function probe(videoPath: string): Promise<VideoInfo> {
    const proc = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=s=x:p=0',
        videoPath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    return new Promise((resolve, reject) => {
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`ffprobe failed: ${stderr || 'unknown error'}`));
                return;
            }
            const parts = stdout.trim().split('x');
            if (parts.length !== 2) {
                reject(new Error(`Failed to parse video dimensions: "${stdout.trim()}"`));
                return;
            }
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);
            if (isNaN(w) || isNaN(h)) {
                reject(new Error(`Invalid video dimensions: ${stdout}`));
                return;
            }
            resolve({ width: w, height: h });
        });
        proc.on('error', reject);
    });
}

function ensureEven(n: number): number {
    return n % 2 === 0 ? n : n + 1;
}

export class FrameDecoder {
    readonly width: number;
    readonly height: number;
    readonly frameSize: number;
    private proc: ChildProcess;
    private dead: boolean = false;
    private errmsg: string = '';

    constructor(videoPath: string, fps: number, width: number, height: number) {
        const w = ensureEven(Math.max(2, width));
        const h = ensureEven(Math.max(2, height));
        this.width = w;
        this.height = h;
        this.frameSize = w * h * 3;

        this.proc = spawn('ffmpeg', [
            '-nostdin',
            '-loglevel', 'error',
            '-i', videoPath,
            '-an',
            '-f', 'rawvideo',
            '-pix_fmt', 'rgb24',
            '-r', String(fps),
            '-s', `${w}x${h}`,
            '-',
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.proc.stderr!.on('data', (chunk: Buffer) => {
            this.errmsg += chunk.toString();
        });

        this.proc.on('close', (code) => {
            this.dead = true;
            if (code !== 0 && code !== null) {
                console.error(`ffmpeg exit ${code}: ${this.errmsg.slice(-500)}`);
            }
        });

        this.proc.on('error', (err) => {
            this.dead = true;
            this.errmsg = err.message;
        });
    }

    readFrame(): Buffer | null {
        const chunk = this.proc.stdout!.read(this.frameSize) as Buffer | null;
        return chunk;
    }

    hasFrame(): boolean {
        return this.proc.stdout!.readableLength >= this.frameSize;
    }

    isAlive(): boolean {
        return !this.dead;
    }

    lastError(): string {
        return this.errmsg.slice(-300);
    }

    dispose(): void {
        this.proc.stdout!.removeAllListeners();
        this.proc.stderr!.removeAllListeners();
        this.proc.removeAllListeners();
        this.proc.kill();
    }
}
