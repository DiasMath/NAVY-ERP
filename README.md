# NAVY — ERP de estética

Prévia publicada em [navy-frontend.vercel.app](https://navy-frontend.vercel.app), hospedada na Vercel por um projeto Next.js 15, React 19 e TypeScript.

O login com Firebase Authentication e os repositórios Firestore estão descritos em [BACKEND.md](BACKEND.md). O passo a passo das integrações está em [GUIA-INTEGRACOES.md](GUIA-INTEGRACOES.md). O projeto `navy-erp` tem duas contas com perfis ativos e regras Firestore publicadas. Clientes já usa dados reais do Firestore; outras telas ainda usam demonstração local ou HTML do Stitch.

## Telas

O login (`/login`) foi adaptado para React/TypeScript a partir do HTML do Stitch. Ele tem um carrossel automático de cinco imagens locais em alta resolução, e-mail/senha, exibição de senha, opção de lembrar o dispositivo e recuperação de acesso. Não há seleção de papel na interface: o perfil efetivo é lido do Firebase.

Os 16 documentos HTML do pacote Stitch, a tela de Clientes e a tela de Relatórios enviadas em seguida estão em `public/stitch/`. Eles foram preservados para que cores, tipografia, espaçamentos, conteúdo e comportamento visual sejam reproduzidos com a maior fidelidade possível.

`lib/stitch-pages.ts` liga as rotas amigáveis às páginas ainda baseadas em HTML. O menu lateral reutilizável está em `components/StitchSidebar.tsx` e a navbar em `components/StitchHeader.tsx`; `components/StitchShell.tsx` monta ambos em todas as telas internas. Os itens ficam em `lib/stitch-navigation.ts` e os estilos em `app/stitch-shell.css`. `components/StitchViewport.tsx` exibe o conteúdo das telas HTML em uma proporção equivalente ao navegador em 80% no desktop. Em telas menores, a escala volta a 100%. Links de WhatsApp com números ilustrativos foram desativados na prévia pública.

Clientes (`/clientes`) já usa uma tela nativa em React/TypeScript em `features/clients/`. A composição visual segue o Stitch. Busca, filtros, seleção, cadastro, edição, exclusão para administradores, sessões, planejamento de retorno, notas clínicas, preferências e exportação CSV usam o Firestore. O cadastro reúne nome, telefone, e-mail, nascimento, cidade, Instagram, preferência de contato e origem; o procedimento pertence aos atendimentos. Foto de perfil e galeria consentida usam rotas autenticadas no servidor e uma pasta privada do Google Drive após a autorização OAuth da conta proprietária. O Firestore guarda somente IDs e metadados das imagens. Rascunhos de contato não são enviados automaticamente. A Agenda ainda é local e não cria agendamentos reais a partir da ficha.

A conexão do Drive fica em **Configurações Gerais → Integrações** (`/configuracoes/integracoes`). Clientes mostra apenas os controles de foto e galeria, que ficam indisponíveis enquanto a integração não estiver ativa.

Serviços (`/servicos`) também é uma tela nativa em React/TypeScript em `features/services/`, mantendo o catálogo e a ficha técnica do Stitch. Busca, filtros de categoria, modalidade e status, seleção, criação, edição, duplicação em homologação, ativação/desativação, regras clínicas e exportação CSV funcionam na prévia local. Duração, intervalo, preço e janela de retorno recebem validações antes de salvar. Os dados usam a chave `navy-services-demo-v1` no `localStorage`, que poderá alimentar a tela de Agenda na próxima etapa.

Os formulários de Clientes distinguem campos obrigatórios e opcionais e mostram erros ao lado do campo. Cadastro valida nome e sobrenome, telefone brasileiro com DDD sem duplicatas, formato de e-mail, nascimento, cidade, Instagram, origem e dependências do contato preferido. Sessões validam procedimento, data, valor e pagamento; manutenções exigem data futura e rejeitam duplicatas. Observações clínicas e próximo retorno também são conferidos. Novas sessões com pagamento pendente não aumentam o total investido. Os diálogos são centralizados na área abaixo da navbar e à direita do menu, acompanhando a largura do menu aberto ou recolhido.

As cores originais dos arquivos Stitch foram restauradas em todas as telas.

Os componentes React em `components/` e `features/` são a base da implementação. As telas restantes ainda mostram HTMLs do Stitch no componente de visualização para evitar diferenças durante a revisão. A migração gradual para componentes React reutilizáveis deverá manter estes HTMLs como referência de comparação.

`public/stitch/navy-ui.js` e `navy-ui.css` mantêm as interações dos conteúdos ainda não migrados: painel lateral de visualização e diálogo de novo agendamento. O painel detalhado de conclusão e o diálogo de agendamento usam os fragmentos HTML enviados pelo Stitch em `public/stitch/ui/`. O menu recolhível, a navegação, a busca de módulos, o perfil e o modo foco pertencem à estrutura compartilhada em React. A busca da navbar pesquisa módulos; busca de clientes e agendamentos dependerá dos dados reais. As ações ainda são prévias visuais, sem gravação de dados.

O menu possui uma barra de rolagem fina e sempre visível. Sua posição é preservada ao trocar de rota, recolher e expandir o menu, e recarregar a página na mesma aba. No celular, data, notificações, ajuda, perfil e busca continuam acessíveis na navbar; o cartão da unidade leva às configurações.

## Executar

Requer Node.js 20 ou superior:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Use `npm run build` para verificar o build e os tipos.

## Estado funcional

Clientes grava dados reais no Firestore. O código de upload e leitura privada de imagens no Drive está pronto; para ativá-lo na instalação é preciso conectar a conta Google proprietária em Clientes. Serviços, Agenda e outras telas ainda contêm dados ilustrativos e interações locais. A configuração pública do app Firebase está ativa para o login. Duas contas têm documentos `users/{uid}` ativos. Não inclua informações reais nas telas que ainda não foram migradas. Nenhuma senha ou chave de conta de serviço foi incluída nos arquivos.
