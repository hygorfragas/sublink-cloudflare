import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CloudflareKvShortenerApi implements ICredentialType {
	name = 'cloudflareKvShortenerApi';

	displayName = 'Cloudflare KV (encurtador)';

	documentationUrl = 'https://developers.cloudflare.com/api/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Token com permissão de escrita/leitura no Workers KV (ex.: Account → Workers KV Storage → Edit).',
		},
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			required: true,
			description: 'ID da conta Cloudflare (visível no painel, canto direito de Workers / Overview).',
		},
		{
			displayName: 'KV Namespace ID',
			name: 'namespaceId',
			type: 'string',
			default: '',
			required: true,
			description: 'ID do namespace KV onde os slugs serão armazenados.',
		},
		{
			displayName: 'Base da URL curta',
			name: 'shortUrlBase',
			type: 'string',
			default: '',
			placeholder: 'https://go.suaempresa.com',
			description:
				'Usado para montar o campo short_url nas respostas (sem barra final). Ex.: https://go.suaempresa.com',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.cloudflare.com/client/v4',
			url: '=/accounts/{{$credentials.accountId}}/storage/kv/namespaces/{{$credentials.namespaceId}}',
		},
	};
}
