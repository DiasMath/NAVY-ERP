# NAVY — ERP de estética

Aplicação publicada em [navy-erp-ecru.vercel.app](https://navy-erp-ecru.vercel.app), hospedada na Vercel por um projeto Next.js 15, React 19 e TypeScript. As páginas enviam `noindex, nofollow` aos mecanismos de busca.

O login com Firebase Authentication e os repositórios Firestore estão descritos em [BACKEND.md](BACKEND.md). O passo a passo das integrações está em [GUIA-INTEGRACOES.md](GUIA-INTEGRACOES.md). Clientes, Serviços e Agenda usam o Firestore. A publicação das regras atualizadas é necessária junto com a nova Agenda.

## Telas

O login (`/login`) foi adaptado para React/TypeScript a partir do HTML do Stitch. Ele tem um carrossel automático de cinco imagens locais em alta resolução, e-mail/senha, exibição de senha, opção de lembrar o dispositivo e recuperação de acesso. Não há seleção de papel na interface: o perfil efetivo é lido do Firebase.

Os 16 documentos HTML do pacote Stitch, a tela de Clientes e a tela de Relatórios enviadas em seguida estão em `public/stitch/`. Eles foram preservados para que cores, tipografia, espaçamentos, conteúdo e comportamento visual sejam reproduzidos com a maior fidelidade possível.

`lib/stitch-pages.ts` liga as rotas amigáveis às páginas ainda baseadas em HTML. O menu lateral reutilizável está em `components/StitchSidebar.tsx` e a navbar em `components/StitchHeader.tsx`; `components/StitchShell.tsx` monta ambos em todas as telas internas. Os itens ficam em `lib/stitch-navigation.ts` e os estilos em `app/stitch-shell.css`. `components/StitchViewport.tsx` exibe o conteúdo das telas HTML em uma proporção equivalente ao navegador em 80% no desktop. Em telas menores, a escala volta a 100%. Links de WhatsApp com números ilustrativos foram desativados na prévia pública.

Clientes (`/clientes`) usa uma tela nativa em React/TypeScript em `features/clients/`. Busca, filtros, seleção, cadastro, edição, exclusão para administradores, sessões, planejamento de retorno, notas clínicas, preferências, agendamentos vinculados e exportação CSV usam o Firestore. O botão **Agendar** abre a Agenda com a cliente selecionada. É possível reservar um atendimento avulso com descrição, duração e valor manual, sem cadastrar profissional ou serviço antes. Planejar um retorno na ficha não reserva horário; a reserva real é feita na Agenda. Foto de perfil e galeria consentida usam rotas autenticadas no servidor e uma pasta privada do Google Drive após a autorização OAuth da conta proprietária. Rascunhos de contato não são enviados automaticamente.

A conexão do Drive fica em **Configurações Gerais → Integrações** (`/configuracoes/integracoes`). Clientes mostra apenas os controles de foto e galeria, que ficam indisponíveis enquanto a integração não estiver ativa.

Serviços (`/servicos`) também é uma tela nativa em React/TypeScript em `features/services/`. Busca, filtros, criação, edição, duplicação em homologação, ativação/desativação, regras clínicas e exportação CSV usam os documentos do Firestore. Profissionais podem ser cadastradas, renomeadas, desativadas e reativadas antes de serem vinculadas aos procedimentos. A foto de apresentação é privada no Google Drive quando a integração está conectada. Serviços ativos com profissional habilitada abrem a Agenda com o procedimento pré-selecionado. A Agenda valida reservas do catálogo contra serviços e profissionais ativos; reservas avulsas usam a duração informada e bloqueiam sobreposição com outras reservas avulsas. Dados antigos da prévia em `localStorage` não são importados automaticamente.

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

Clientes, Serviços e Agenda gravam dados reais no Firestore. O upload e a leitura privada de imagens dependem de conectar a conta proprietária do Google Drive em Configurações Gerais → Integrações. Outras telas ainda podem conter dados ilustrativos e interações locais. A configuração pública do Firebase está ativa para o login. Nenhuma senha ou chave de conta de serviço foi incluída nos arquivos.
