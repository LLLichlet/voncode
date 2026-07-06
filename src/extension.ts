import * as vscode from 'vscode';
import { checkFfmpeg } from './decoder';
import { Player } from './player';

let player: Player | null = null;

export function activate(context: vscode.ExtensionContext) {
    const playCmd = vscode.commands.registerCommand('voncode.play', async () => {
        if (!checkFfmpeg()) {
            vscode.window.showErrorMessage(
                'ffmpeg/ffprobe not found. Install ffmpeg and add it to PATH.',
            );
            return;
        }

        if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage('Open a file first to use as viewport reference.');
            return;
        }

        const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Video files': ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv'] },
        });

        if (!files || files.length === 0) { return; }

        if (!player) {
            player = new Player();
        }

        try {
            await player.play(files[0].fsPath, 5);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Playback error: ${e.message}`);
        }
    });

    const stopCmd = vscode.commands.registerCommand('voncode.stop', () => {
        if (player) {
            player.stop();
        }
    });

    context.subscriptions.push(playCmd, stopCmd);
}

export function deactivate() {
    if (player) {
        player.dispose();
        player = null;
    }
}
