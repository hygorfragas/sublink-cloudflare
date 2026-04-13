import type { IDataObject } from 'n8n-workflow';

const SLUG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,500}$/;

export type KvLinkRecord = {
	url: string;
	active: boolean;
	created_at?: string;
	updated_at?: string;
	clicks?: number;
};

export function assertValidSlug(slug: string): void {
	const trimmed = slug.trim();
	if (!trimmed) {
		throw new Error('O slug não pode ser vazio.');
	}
	if (!SLUG_REGEX.test(trimmed)) {
		throw new Error(
			'Slug inválido: use apenas letras, números, hífen e underscore; não use espaços. Máximo ~500 caracteres.',
		);
	}
}

export function assertValidUrl(url: string): void {
	const trimmed = url.trim();
	if (!trimmed) {
		throw new Error('A URL de destino não pode ser vazia.');
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error('URL de destino inválida (use http/https completo).');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('A URL deve usar http ou https.');
	}
}

export function parseKvBody(body: unknown): KvLinkRecord {
	if (body === null || body === undefined) {
		return { url: '', active: false };
	}
	if (typeof body === 'object' && !Array.isArray(body)) {
		const o = body as IDataObject;
		const url = typeof o.url === 'string' ? o.url : '';
		const active = typeof o.active === 'boolean' ? o.active : true;
		return {
			url,
			active,
			created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
			updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
			clicks: typeof o.clicks === 'number' ? o.clicks : undefined,
		};
	}
	if (typeof body === 'string') {
		try {
			const parsed = JSON.parse(body) as IDataObject;
			return parseKvBody(parsed);
		} catch {
			return { url: body.trim(), active: true };
		}
	}
	return { url: String(body), active: true };
}

export function normalizeShortUrlBase(base: string): string {
	return base.trim().replace(/\/+$/, '');
}

export function buildShortUrl(base: string | undefined, slug: string): string | undefined {
	const b = base?.trim();
	if (!b) return undefined;
	return `${normalizeShortUrlBase(b)}/${encodeURIComponent(slug).replace(/%2F/g, '/')}`;
}
