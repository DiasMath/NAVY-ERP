# NAVY — código, publicação e integrações

## O que já existe

| Parte | Estado atual |
| --- | --- |
| Next.js, React e TypeScript | Projeto executável e publicado na Vercel. |
| Interface | Login, Clientes e Serviços em React com Firebase. Agenda ainda usa dados locais de demonstração. Outras telas usam HTML de referência do Stitch. |
| Firebase Authentication | App Web `navy-erp` conectado, E-mail/senha ativo e duas contas com perfis `master_admin` e `admin`. |
| Cloud Firestore | Banco e regras publicados. Clientes grava cadastros e sessões; Serviços grava catálogo e profissionais. |
| Google Drive | API ativada. Rotas privadas de imagens de Clientes e Serviços implementadas; a conta proprietária deve autorizar o app em Configurações → Integrações. |
| GitHub | Repositório `DiasMath/NAVY-ERP` conectado aos projetos Vercel; pushes em `main` publicam novas versões. |

## O que você precisa criar

### 1. Firebase

1. O projeto `navy-erp` e seu **app Web** já existem. A configuração pública foi obtida do Firebase e aplicada localmente e na Vercel. O JSON de conta de serviço recebido permanece fora do projeto.
2. **Authentication → E-mail/senha** já está habilitado. As duas contas iniciais têm perfis ativos. Para novas contas, crie cada usuário com uma senha definida por ele no console. Não envie senha no chat e não a grave no código.
3. O **Cloud Firestore** existe e `firestore.rules` já foi publicado. Teste alterações futuras das regras antes de usar dados reais.
4. Para cada nova conta, crie o documento `users/{uid}` com `name`, `clinicId`, `role` e `active: true`. Exemplo em `BACKEND.md`.
5. O `.env.local` local e as cinco variáveis públicas de Production na Vercel já foram preenchidos. Para outra máquina, copie `.env.example` para `.env.local` e obtenha novamente o objeto de configuração do app Web no console. Configure Preview separadamente se usar essa modalidade.
6. Confira **Authentication → Settings → Authorized domains** e inclua o domínio final da NAVY se ele não estiver na lista.

As variáveis `NEXT_PUBLIC_*` são configuração pública do app Web. Não coloque senha, token OAuth ou chave de conta de serviço nelas. O papel real vem de `users/{uid}` e das regras do Firestore; a tela de login não oferece seleção de papel.

### 2. Google Drive para imagens

1. A pasta privada `NAVY-ERP` foi identificada na conta `sandesdiasmatheus@gmail.com`, e a Google Drive API está ativa no projeto `navy-erp`.
2. O cliente OAuth Web usa o retorno `https://navy-erp-ecru.vercel.app/api/drive/oauth/callback`. Em **Configurações Gerais → Integrações**, um administrador deve clicar em **Conectar Google Drive** e autorizar com a conta proprietária. O aplicativo cria a pasta privada `NAVY Clientes`; depois ela pode ser movida para dentro de `NAVY-ERP` sem torná-la pública.
3. As credenciais OAuth, a chave de criptografia e o JSON da conta de serviço estão em variáveis privadas de Production na Vercel. O JSON local fica fora do repositório; `.env.local` está ignorado pelo Git. Nunca envie esses valores ao GitHub nem use prefixo `NEXT_PUBLIC_` neles.
4. As rotas Next.js verificam o usuário Firebase e sua unidade, aceitam JPEG/PNG/WebP e recodificam para JPEG. Fotos de clientes e de procedimentos são lidas por endpoints autenticados; o Firestore guarda IDs e metadados. A galeria de clientes exige confirmação de consentimento antes do envio.

### 3. GitHub e Vercel

1. O código de referência está em `https://github.com/DiasMath/NAVY-ERP` na branch `main`.
2. O projeto Vercel `navy-erp` publica `https://navy-erp-ecru.vercel.app` a partir do GitHub. Há também um projeto Vercel antigo chamado `navy-frontend`; o endereço e callback atuais são os do projeto `navy-erp`.
3. As variáveis sensíveis ficam no ambiente da Vercel e não devem ser enviadas ao GitHub. Para desenvolvimento local, use `.env.local`, que é ignorado pelo Git.

## Ordem recomendada de implementação

1. Validar com uma conta autorizada o cadastro, edição e exclusão de Clientes no Firestore.
2. Conectar manualmente o Google Drive em Configurações → Integrações e verificar fotos de Clientes e Serviços.
3. Validar o catálogo de Serviços e profissionais no Firestore com uma conta administradora.
4. Migrar Agenda para Clientes, Serviços, Profissionais e agendamentos do Firestore, com prevenção de conflitos de horário.
5. Concluir edição e exclusão de sessões clínicas na ficha da cliente.

O login da v1 usa apenas e-mail/senha. Biometria e código por WhatsApp não fazem parte da interface atual.

## Referências oficiais

- [Configuração do Firebase para Web](https://firebase.google.com/docs/web/setup)
- [Firebase Authentication por e-mail/senha](https://firebase.google.com/docs/auth/web/password-auth)
- [Regras de segurança do Firestore](https://firebase.google.com/docs/firestore/security/get-started)
- [Habilitar APIs do Google Workspace](https://developers.google.com/workspace/guides/enable-apis)
- [Upload de arquivos pela Drive API](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables)
