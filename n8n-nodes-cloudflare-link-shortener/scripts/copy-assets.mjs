import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src/nodes/CloudflareLinkShortener');
const outDir = join(root, 'dist/nodes/CloudflareLinkShortener');

await mkdir(outDir, { recursive: true });
await copyFile(join(srcDir, 'cloudflare.svg'), join(outDir, 'cloudflare.svg'));
await copyFile(
	join(srcDir, 'CloudflareLinkShortener.node.json'),
	join(outDir, 'CloudflareLinkShortener.node.json'),
);
