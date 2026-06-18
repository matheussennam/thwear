# Catalogo Drive MVP

MVP local para transformar a pasta do fornecedor no Google Drive em um catalogo visual com filtros e pedido por WhatsApp.

## Como rodar

```bash
cd /Users/senna/Documents/Codex/2026-06-18/files-mentioned-by-the-user-audio/outputs/catalog-mvp
python3 -m http.server 4173
```

Abra `http://127.0.0.1:4173`.

## Fonte dos dados

Os itens de `data/catalog.json` foram montados a partir da pasta:

`https://drive.google.com/drive/folders/1E6XqPMoxn-xq36Kf4wVkYW3JlupTyjIU`

O MVP usa a estrutura do caminho para inferir:

- categoria
- tamanho
- marca quando aparece na pasta
- link da imagem
- link original do Drive

## WhatsApp

O numero que recebe os pedidos fica em `data/settings.json`.

Preencha `whatsappNumber` com DDI + DDD + numero, somente digitos:

```json
{
  "whatsappNumber": "5571999999999"
}
```

Enquanto esse campo estiver vazio, os botoes abrem o WhatsApp sem destinatario fixo.

## Deploy no Render

Esta pasta ja tem um `render.yaml` para publicar como Static Site no Render.

O Render precisa que esta pasta esteja em um repositorio GitHub/GitLab/Bitbucket. Depois de subir o repo:

```bash
git add .
git commit -m "Publica catalogo Drive"
git push origin main
```

Abra:

`https://dashboard.render.com/blueprint/new?repo=URL_DO_REPOSITORIO`

Exemplo:

`https://dashboard.render.com/blueprint/new?repo=https://github.com/usuario/catalogo-drive`

## Fallback: GitHub Pages

Tambem existe `.github/workflows/pages.yml`. Se o GitHub Pages estiver habilitado nas configuracoes do repositorio, cada push na `main` publica o site automaticamente.

Como o site e estatico, GitHub Pages e Render funcionam bem para teste. Para producao com mais controle de headers, Render e melhor.

## Seguranca

Veja `SECURITY.md`. O site foi configurado sem backend publico, sem script externo, com CSP e headers de seguranca para reduzir superficie de ataque. Contra DoS, a principal defesa e publicar como Static Site atras de CDN.

## Proxima automacao

Para regenerar o catalogo com a API do Drive:

```bash
cd /Users/senna/Documents/Codex/2026-06-18/files-mentioned-by-the-user-audio/outputs/catalog-mvp
GOOGLE_ACCESS_TOKEN=... node scripts/drive-sync.mjs --root 1E6XqPMoxn-xq36Kf4wVkYW3JlupTyjIU --out data/catalog.json
```

Para producao, o repo inclui `.github/workflows/sync-catalog.yml`, que roda todo dia as 07:00 BRT e tambem pode ser disparado manualmente.

Configure o secret `GOOGLE_SERVICE_ACCOUNT_JSON` no GitHub com uma service account do Google. A pasta do fornecedor precisa ser compartilhada com o e-mail dessa service account.

Esse job diario:

1. ler a arvore completa do Drive;
2. gerar registros novos para imagens novas;
3. marcar como indisponiveis imagens removidas;
4. commitar mudancas em `data/catalog.json`;
5. disparar novo deploy automatico no Render.

A etapa de IA de visao para descricao, cor, marca provavel e qualidade da foto entra como proximo passo, usando uma chave de IA e salvando os campos enriquecidos no mesmo `catalog.json`.
