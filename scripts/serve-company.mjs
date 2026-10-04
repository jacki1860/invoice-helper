import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

// Serve the actual company build, including its /invoice/ prefix and real 404s.
const root = await realpath(resolve('dist/client'));
const port = Number(process.env.COMPANY_TEST_PORT || 4178);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid test port');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!['GET', 'HEAD'].includes(request.method) || !pathname.startsWith('/invoice/')) {
      response.writeHead(404).end();
      return;
    }
    const relative = pathname.slice('/invoice/'.length);
    if (relative.split('/').some((part) => part.startsWith('.') || part.includes('\\'))) {
      response.writeHead(404).end();
      return;
    }
    let filename = resolve(root, relative);
    if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
    filename = await realpath(filename);
    if (!filename.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    const data = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError) {
      response.writeHead(404).end();
    } else {
      console.error(error);
      response.writeHead(500).end();
    }
  }
}).listen(port, '127.0.0.1', () => console.log(`Company build: http://127.0.0.1:${port}/invoice/`));
