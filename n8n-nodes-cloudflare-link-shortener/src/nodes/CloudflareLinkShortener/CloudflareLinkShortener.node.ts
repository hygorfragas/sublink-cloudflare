import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeConnectionType, NodeApiError } from 'n8n-workflow';

import {
	assertValidSlug,
	assertValidUrl,
	buildShortUrl,
	parseKvBody,
	type KvLinkRecord,
} from './helpers';

type CloudflareEnvelope = {
	success?: boolean;
	errors?: Array<{ code?: number; message?: string }>;
};

function assertCloudflareOk(
	this: IExecuteFunctions,
	body: unknown,
	itemIndex: number,
): void {
	if (typeof body !== 'object' || body === null) return;
	const o = body as CloudflareEnvelope;
	if (o.success === false && Array.isArray(o.errors) && o.errors[0]?.message) {
		throw new NodeApiError(this.getNode(), body as JsonObject, {
			itemIndex,
			message: o.errors[0].message,
		});
	}
}

export class CloudflareLinkShortener implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cloudflare Link Shortener',
		name: 'cloudflareLinkShortener',
		icon: 'file:cloudflare.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'CRUD de links curtos no Workers KV via API Cloudflare (compatível com Worker de redirect).',
		defaults: {
			name: 'Cloudflare Link Shortener',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'cloudflareKvShortenerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operação',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Criar', value: 'create', description: 'Grava slug → destino no KV' },
					{ name: 'Atualizar', value: 'update', description: 'Altera URL e/ou active' },
					{ name: 'Obter', value: 'get', description: 'Lê registro do slug' },
					{ name: 'Excluir', value: 'delete', description: 'Remove o slug do KV' },
					{ name: 'Listar Chaves', value: 'list', description: 'Lista slugs (paginação KV)' },
				],
				default: 'create',
			},
			{
				displayName: 'Slug',
				name: 'slug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['create', 'update', 'get', 'delete'],
					},
				},
				description: 'Caminho curto (ex.: campanha-natal). Aparece como /slug no seu domínio.',
			},
			{
				displayName: 'URL de Destino',
				name: 'targetUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['create'],
					},
				},
				description: 'URL completa para onde o redirect deve apontar.',
			},
			{
				displayName: 'Nova URL de Destino',
				name: 'newUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['update'],
					},
				},
				description: 'Se vazio, mantém a URL já salva no registro.',
			},
			{
				displayName: 'Ativo',
				name: 'active',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['create', 'update'],
					},
				},
				description:
					'Quando inativo, seu Worker deve responder 404 ou bloquear (o valor ainda fica no KV).',
			},
			{
				displayName: 'Limite',
				name: 'limit',
				type: 'number',
				default: 100,
				typeOptions: { minValue: 1, maxValue: 1000 },
				displayOptions: {
					show: {
						operation: ['list'],
					},
				},
				description: 'Máximo de chaves nesta página (API Cloudflare).',
			},
			{
				displayName: 'Prefixo',
				name: 'prefix',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['list'],
					},
				},
				description: 'Filtra chaves que começam com este texto (opcional).',
			},
			{
				displayName: 'Cursor',
				name: 'cursor',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['list'],
					},
				},
				description: 'Token da página seguinte (result_info.cursor da chamada anterior).',
			},
			{
				displayName: 'Buscar Destinos',
				name: 'fetchValues',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['list'],
					},
				},
				description:
					'Se ativo, faz GET em cada chave (1 requisição por link). Use só com limite baixo.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		const cred = await this.getCredentials('cloudflareKvShortenerApi');
		const accountId = String(cred.accountId ?? '').trim();
		const namespaceId = String(cred.namespaceId ?? '').trim();
		const shortUrlBaseRaw = String(cred.shortUrlBase ?? '').trim();

		const baseV4 = 'https://api.cloudflare.com/client/v4';
		const nsBase = `${baseV4}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'create') {
					const slug = String(this.getNodeParameter('slug', i));
					const targetUrl = String(this.getNodeParameter('targetUrl', i));
					const active = this.getNodeParameter('active', i) as boolean;
					assertValidSlug(slug);
					assertValidUrl(targetUrl);
					const now = new Date().toISOString();
					const record: KvLinkRecord = {
						url: targetUrl.trim(),
						active,
						created_at: now,
						updated_at: now,
						clicks: 0,
					};
					const opts: IHttpRequestOptions = {
						method: 'PUT',
						url: `${nsBase}/values/${encodeURIComponent(slug)}`,
						body: record,
						json: true,
					};
					const res = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						opts,
					);
					assertCloudflareOk.call(this, res, i);
					const short_url = buildShortUrl(shortUrlBaseRaw, slug);
					out.push({
						json: {
							slug,
							short_url,
							...record,
							cloudflare: res,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'update') {
					const slug = String(this.getNodeParameter('slug', i));
					const newUrlRaw = String(this.getNodeParameter('newUrl', i) ?? '');
					const active = this.getNodeParameter('active', i) as boolean;
					assertValidSlug(slug);

					const existingRaw = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						{
							method: 'GET',
							url: `${nsBase}/values/${encodeURIComponent(slug)}`,
							returnFullResponse: true,
							json: false,
							ignoreHttpStatusErrors: true,
						} as IHttpRequestOptions,
					);

					const status = (existingRaw as { statusCode?: number }).statusCode ?? 200;
					if (status === 404) {
						throw new NodeApiError(this.getNode(), { message: 'Slug não encontrado.' }, { itemIndex: i });
					}
					const bodyText = (existingRaw as { body?: unknown }).body;
					const parsed = parseKvBody(
						typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText),
					);
					if (!parsed.url && !newUrlRaw.trim()) {
						throw new NodeApiError(
							this.getNode(),
							{ message: 'Registro sem URL e nenhuma nova URL informada.' },
							{ itemIndex: i },
						);
					}
					if (newUrlRaw.trim()) {
						assertValidUrl(newUrlRaw);
					}
					const now = new Date().toISOString();
					const merged: KvLinkRecord = {
						url: newUrlRaw.trim() ? newUrlRaw.trim() : parsed.url,
						active,
						created_at: parsed.created_at ?? now,
						updated_at: now,
						clicks: parsed.clicks ?? 0,
					};
					const putRes = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						{
							method: 'PUT',
							url: `${nsBase}/values/${encodeURIComponent(slug)}`,
							body: merged,
							json: true,
						},
					);
					assertCloudflareOk.call(this, putRes, i);
					const short_url = buildShortUrl(shortUrlBaseRaw, slug);
					out.push({
						json: { slug, short_url, ...merged, cloudflare: putRes },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'get') {
					const slug = String(this.getNodeParameter('slug', i));
					assertValidSlug(slug);
					const raw = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						{
							method: 'GET',
							url: `${nsBase}/values/${encodeURIComponent(slug)}`,
							returnFullResponse: true,
							json: false,
							ignoreHttpStatusErrors: true,
						} as IHttpRequestOptions,
					);
					const status = (raw as { statusCode?: number }).statusCode ?? 200;
					if (status === 404) {
						throw new NodeApiError(this.getNode(), { message: 'Slug não encontrado.' }, { itemIndex: i });
					}
					const bodyText = (raw as { body?: unknown }).body;
					const record = parseKvBody(
						typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText),
					);
					const short_url = buildShortUrl(shortUrlBaseRaw, slug);
					out.push({
						json: { slug, short_url, ...record },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'delete') {
					const slug = String(this.getNodeParameter('slug', i));
					assertValidSlug(slug);
					const delRes = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						{
							method: 'DELETE',
							url: `${nsBase}/values/${encodeURIComponent(slug)}`,
							json: true,
						},
					);
					assertCloudflareOk.call(this, delRes, i);
					out.push({
						json: { slug, deleted: true, cloudflare: delRes },
						pairedItem: { item: i },
					});
					continue;
				}

				if (operation === 'list') {
					const limit = Number(this.getNodeParameter('limit', i));
					const prefix = String(this.getNodeParameter('prefix', i) ?? '').trim();
					const cursor = String(this.getNodeParameter('cursor', i) ?? '').trim();
					const fetchValues = this.getNodeParameter('fetchValues', i) as boolean;

					const qs: IDataObject = { limit };
					if (prefix) qs.prefix = prefix;
					if (cursor) qs.cursor = cursor;

					const listRes = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'cloudflareKvShortenerApi',
						{
							method: 'GET',
							url: `${nsBase}/keys`,
							qs,
							json: true,
						},
					);
					assertCloudflareOk.call(this, listRes, i);

					const env = listRes as {
						result?: Array<{ name?: string }>;
						result_info?: { cursor?: string; count?: number };
					};
					const keys = Array.isArray(env.result) ? env.result : [];
					const rows: IDataObject[] = [];

					for (const k of keys) {
						const slug = String(k.name ?? '');
						const row: IDataObject = {
							slug,
							short_url: buildShortUrl(shortUrlBaseRaw, slug),
						};
						if (fetchValues && slug) {
							try {
								const raw = await this.helpers.httpRequestWithAuthentication.call(
									this,
									'cloudflareKvShortenerApi',
									{
										method: 'GET',
										url: `${nsBase}/values/${encodeURIComponent(slug)}`,
										returnFullResponse: true,
										json: false,
										ignoreHttpStatusErrors: true,
									} as IHttpRequestOptions,
								);
								const status = (raw as { statusCode?: number }).statusCode ?? 200;
								if (status !== 404) {
									const bodyText = (raw as { body?: unknown }).body;
									const record = parseKvBody(
										typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText),
									);
									Object.assign(row, record);
								}
							} catch {
								row.fetch_error = true;
							}
						}
						rows.push(row);
					}

					out.push({
						json: {
							links: rows,
							next_cursor: env.result_info?.cursor,
							count: env.result_info?.count,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeApiError(this.getNode(), { message: `Operação desconhecida: ${operation}` }, { itemIndex: i });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [out];
	}
}
