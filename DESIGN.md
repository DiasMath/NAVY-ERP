# Referência visual NAVY

## Fonte

Os 16 HTMLs do pacote Stitch e os HTMLs de Clientes e Relatórios enviados em seguida são a referência de layout. As 18 telas estão preservadas em `public/stitch/` e são exibidas pelo componente `StitchViewport` nas rotas definidas em `lib/stitch-pages.ts`.

## Sistema observado no pacote mais recente

- Fontes: **Inter** e **Plus Jakarta Sans**, com **Material Symbols Outlined** para ícones.
- Barra lateral branca fixa de 288 px, navegação agrupada e cabeçalho branco de 64 px.
- Fundo azul muito claro `#F3F7FC`, cartões brancos e bordas suaves.
- Azul `#376380` nas ações principais e no texto de destaque; azuis mais claros nos estados selecionados.
- Tons verdes, âmbar e vermelhos representam estados operacionais.
- Layouts responsivos definidos diretamente nas classes e regras de cada HTML.
- No desktop, o componente de visualização usa 80% de escala e 125% de viewport interno, reproduzindo a proporção escolhida pelo usuário sem exigir zoom manual. Abaixo de 900 px, usa escala normal.

## Critério de fidelidade

Cada rota deve ser comparada com o respectivo HTML do Stitch na mesma largura de viewport. Textos, imagens, ícones, estados iniciais e distribuição dos painéis fazem parte da referência. A futura extração para componentes React deve preservar a aparência e a navegação já publicadas.

## Tela de Clientes

A versão enviada após o pacote principal substitui a referência anterior e segue a mesma navegação visual das demais páginas.
