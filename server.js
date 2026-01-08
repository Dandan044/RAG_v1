import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHIVE_ROOT = path.join(__dirname, 'archives');

// Ensure root exists
if (!fs.existsSync(ARCHIVE_ROOT)) {
    fs.mkdirSync(ARCHIVE_ROOT);
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save-archive') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const { sessionId, content, round } = JSON.parse(body);
                
                if (!sessionId || !content) {
                    throw new Error('Missing sessionId or content');
                }

                // Create session folder if not exists
                // sessionId is expected to be a timestamp string like "2024-01-01_12-00-00"
                const sessionDir = path.join(ARCHIVE_ROOT, sessionId);
                if (!fs.existsSync(sessionDir)) {
                    fs.mkdirSync(sessionDir, { recursive: true });
                }

                // Append to novel.txt
                const filePath = path.join(sessionDir, 'novel.txt');
                
                // If it's the first write, maybe don't add newlines at start, but for simplicity we append.
                const textToAppend = `\n\n=== 第 ${round} 轮 ===\n\n${content}`;
                
                fs.appendFileSync(filePath, textToAppend, 'utf8');
                console.log(`[Archive] Saved round ${round} to ${sessionId}/novel.txt`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('[Archive Error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

const DEFAULT_PORT = 3001;
const startPortRaw = process.env.ARCHIVE_PORT ?? process.env.PORT;
const startPortParsed = startPortRaw ? Number.parseInt(startPortRaw, 10) : DEFAULT_PORT;
const startPort = Number.isFinite(startPortParsed) ? startPortParsed : DEFAULT_PORT;
const maxAttempts = 10;

let currentPort = startPort;
const handleError = (err) => {
    if (err?.code === 'EADDRINUSE' && currentPort < startPort + maxAttempts - 1) {
        currentPort += 1;
        server.listen(currentPort);
        return;
    }
    throw err;
};

server.on('error', handleError);
server.listen(currentPort, () => {
    server.off('error', handleError);
    console.log(`Archive server running on http://localhost:${currentPort}`);
});
