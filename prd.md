Aqui está um **PRD (Product Requirements Document)** estruturado para o seu projeto — já pensado como produto real, multi-tenant e distribuível como node de comunidade do n8n 👇

---

# 📄 PRD — Encurtador de Links Multi-Tenant com Cloudflare + n8n

## 🧠 Visão do Produto

Criar um **encurtador de links white-label, multi-tenant**, baseado em **Cloudflare Workers + KV**, com gerenciamento via **n8n**, distribuído como um **node de comunidade (npm package)**.

O produto permitirá que **qualquer usuário conecte sua própria conta Cloudflare** e crie um encurtador com domínio próprio, sem precisar desenvolver infraestrutura.

---

## 🎯 Objetivo Principal

Permitir que usuários do n8n:

* Criem links curtos personalizados (slug custom)
* Usem **domínio próprio**
* Escondam URLs internas (ex: webhooks do n8n)
* Gerenciem links diretamente dentro do n8n
* Façam isso usando **suas próprias credenciais Cloudflare (multi-tenant)**

---

## 🧩 Problema que Resolve

Hoje:

* Webhooks do n8n são URLs longas e feias
* Não existe solução nativa para encurtamento com domínio próprio
* Ferramentas externas (Bitly, etc.):

  * cobram caro
  * limitam branding
  * não são integradas ao n8n

---

## 💡 Solução Proposta

Criar:

### 1. Infra (lado do usuário)

* Cloudflare Worker
* Workers KV (ou D1 no futuro)
* Domínio customizado

### 2. Integração n8n (produto principal)

* Node de comunidade npm:

```bash
n8n-nodes-cloudflare-shortener
```

### 3. Arquitetura

```text
Usuário → domínio curto (Cloudflare)
        → Worker
        → KV lookup
        → redirect

n8n → API Cloudflare → gerencia KV
```

---

## 🏗️ Arquitetura Técnica

### Componentes

#### 🔹 Cloudflare Worker

Responsável por:

* receber requisição
* extrair slug
* consultar KV
* redirecionar

#### 🔹 Workers KV

Armazena:

```json
{
  "slug": {
    "url": "https://destino.com",
    "active": true,
    "created_at": "...",
    "tenant_id": "...",
    "metadata": {}
  }
}
```

#### 🔹 n8n Community Node

Interface do usuário

#### 🔹 Cloudflare API

Usada para:

* CRUD de KV
* gerenciamento opcional de Worker (futuro)

---

## 🧑‍💻 Multi-Tenant (Requisito Principal)

Cada usuário deve poder:

* usar sua própria conta Cloudflare
* usar seu próprio domínio
* ter seu próprio KV namespace
* isolar completamente seus dados

### 🔐 Autenticação

Cada usuário fornecerá:

* API Token Cloudflare
* Account ID
* KV Namespace ID

Opcional:

* Zone ID (se for automatizar domínio)

---

## ⚙️ Funcionalidades

### MVP (v1)

#### 1. Criar link curto

Input:

* slug
* target_url

Output:

* short_url

---

#### 2. Atualizar link

* trocar URL destino
* ativar/desativar

---

#### 3. Deletar link

---

#### 4. Buscar link

* retornar dados do slug

---

#### 5. Listar links

(opcional no MVP, depende da estratégia KV)

---

## 🚀 Funcionalidades Futuras

* geração automática de slug
* analytics de clique
* expiração de link
* UTM builder
* QR Code
* suporte a D1 (queryável)
* dashboard UI
* criação automática de Worker via API
* suporte a múltiplos domínios por tenant

---

## 📦 Produto: Node n8n (npm)

### Nome sugerido

```bash
n8n-nodes-cloudflare-link-shortener
```

---

## 🧱 Estrutura do Node

### Credenciais (n8n credentials)

```ts
CloudflareCredentials:
- apiToken
- accountId
- namespaceId
```

---

### Nodes disponíveis

#### 1. Create Link

* slug
* target_url

#### 2. Update Link

* slug
* new_url
* active

#### 3. Delete Link

* slug

#### 4. Get Link

* slug

#### 5. List Links (limitado)

(depende de estratégia KV ou index auxiliar)

---

## 🔌 Integração com Cloudflare

### Endpoint KV API

```http
PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key}
```

### Headers

```http
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

---

## 📊 Modelo de Dados

### KV Value (JSON)

```json
{
  "url": "https://destino.com",
  "active": true,
  "created_at": "2026-04-12T10:00:00Z",
  "updated_at": "2026-04-12T10:00:00Z",
  "clicks": 0
}
```

---

## 🧪 Regras de Negócio

* slug deve ser único por namespace
* slug não pode conter:

  * espaços
  * caracteres especiais inválidos
* URL deve ser válida
* redirect deve respeitar:

  * active = true
* fallback → 404

---

## 🛡️ Segurança

* uso de API Token (escopo mínimo)
* não armazenar credenciais fora do n8n
* validação de input no node
* rate limiting opcional no Worker

---

## ⚡ Performance

* lookup KV é O(1)
* Worker roda na edge
* latência global baixa

---

## 📉 Limitações (importantes)

* KV não é ideal para listagem massiva
* eventual consistency (pequeno delay em propagação)
* analytics limitado sem extensão

---

## 🎯 Público-Alvo

* usuários de n8n (self-hosted ou cloud)
* automações de marketing
* SaaS builders
* agências
* devs que querem white-label

---

## 📌 Casos de Uso

* encurtar webhook do n8n
* criar links de campanha
* criar links internos organizados
* criar endpoints públicos “bonitos”
* redirecionamento dinâmico

---

## 🧭 Roadmap

### Fase 1 — MVP

* Worker manual
* KV manual
* Node com CRUD básico

### Fase 2 — Experiência melhor

* setup guiado
* validação automática
* geração de slug

### Fase 3 — Produto completo

* analytics
* UI externa
* multi-domínio
* templates

---

## 🏁 Critérios de Sucesso

* usuário cria link em < 1 minuto
* redirect funciona globalmente
* setup Cloudflare < 10 minutos
* node fácil de instalar e usar

---

## 💬 Diferencial do Produto

* **100% white-label**
* **multi-tenant real**
* **sem dependência de SaaS externo**
* **integrado nativamente ao n8n**
* **infra ultra barata (Cloudflare free tier)**
