# Seguranca

Este catalogo e um site estatico. Ele nao recebe login, senha, pagamento ou dados sensiveis do comprador.

## Medidas aplicadas

- Sem backend publico para reduzir superficie de ataque.
- Sem script externo em producao; a biblioteca de icones fica em `vendor/lucide.min.js`.
- Content Security Policy no `render.yaml`.
- Bloqueio de iframe por `X-Frame-Options` e `frame-ancestors`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` bloqueando camera, microfone, geolocalizacao e pagamento.
- Dados e `index.html` sem cache agressivo para receber atualizacoes do catalogo.
- Carrinho limitado a 20 itens para evitar URLs gigantes no WhatsApp.
- Automacao do GitHub com permissoes minimas para escrever somente no conteudo do repo.

## DoS

O site publicado como Static Site fica atras de CDN no Render ou no GitHub Pages. Isso e mais resistente a picos de acesso do que um servidor proprio pequeno.

A automacao diaria de Drive nao fica exposta publicamente; ela roda em GitHub Actions com credenciais em secrets. Se o volume de fotos crescer muito, a proxima protecao e processar apenas arquivos alterados desde a ultima sincronizacao.

## Segredos

Nunca coloque chaves do Google, tokens de IA ou senhas em arquivos do site. Use secrets do GitHub ou variaveis de ambiente da plataforma.
