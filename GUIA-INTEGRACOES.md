# NAVY — código, publicação e integrações

## O que já existe

| Parte | Estado atual |
| --- | --- |
| Next.js, React e TypeScript | Projeto executável e publicado na Vercel. |
| Interface | Login e Clientes em React com Firebase; Serviços e Agenda interativos com dados locais de demonstração. Outras telas ainda usam HTML de referência do Stitch. |
| Firebase Authentication | App Web `navy-erp` conectado, E-mail/senha ativo e duas contas com perfis `master_admin` e `admin`. |
| Cloud Firestore | Banco e regras publicados. Clientes lê e grava cadastros e sessões; demais telas ainda não usam o banco. |
| Google Drive | API ativada. Rotas privadas de foto de perfil e galeria de Clientes implementadas; falta a proprietária autorizar o app uma vez. |
| GitHub | Código pronto para versionamento. O deploy atual foi feito pela CLI e ainda não está ligado ao repositório `DiasMath/NAVY-ERP`. |

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
2. O cliente OAuth Web usa o retorno `https://navy-frontend.vercel.app/api/drive/oauth/callback`. Na tela de Clientes, um administrador deve clicar em **Conectar Google Drive** e autorizar com essa conta Google. O aplicativo cria a pasta privada `NAVY Clientes`; depois ela pode ser movida para dentro de `NAVY-ERP` sem torná-la pública.
3. As credenciais OAuth, a chave de criptografia e o JSON da conta de serviço estão em variáveis privadas de Production na Vercel. O JSON local fica fora do repositório; `.env.local` está ignorado pelo Git. Nunca envie esses valores ao GitHub nem use prefixo `NEXT_PUBLIC_` neles.
4. As rotas Next.js verificam o usuário Firebase e sua unidade, aceitam JPEG/PNG/WebP e recodificam para JPEG. Foto de perfil e galeria são lidas por endpoint autenticado; o Firestore guarda IDs e metadados. A galeria exige confirmação de consentimento antes do envio.

### 3. GitHub e Vercel

1. Use o repositório existente `https://github.com/DiasMath/NAVY-ERP`.
2. Extraia o ZIP e envie o conteúdo da pasta `navy-frontend` à raiz do repositório. O pacote inclui `.gitignore`, `.env.example`, `README.md`, `BACKEND.md` e este guia; não inclui `node_modules`, build nem segredos.
3. Em **Vercel → navy-frontend → Settings → Git**, conecte esse repositório. O deploy publicado pela CLI continua ativo; após conectar o GitHub, novos pushes podem criar novos deploys. As variáveis já cadastradas no projeto Vercel permanecem lá.

Para enviar pelo terminal, dentro da pasta extraída:

```bash
npm install
npm run build
git init
git add .
git commit -m "Primeira versão da NAVY"
git branch -M main
git remote add origin https://github.com/DiasMath/NAVY-ERP.git
git push -u origin main
```

## Ordem recomendada de implementação

1. Criar Firebase e conectar Authentication e Firestore, validando o primeiro administrador.
2. Validar Clientes com uma conta autorizada e conferir a gravação no console Firestore.
3. Migrar Serviços e cadastro de profissionais/disponibilidade.
4. Migrar Agenda com prevenção real de conflitos de horário.
5. Integrar imagens ao Drive e vincular IDs aos registros pertinentes.

O login da v1 usa apenas e-mail/senha. Biometria e código por WhatsApp não fazem parte da interface atual.

## Referências oficiais

- [Configuração do Firebase para Web](https://firebase.google.com/docs/web/setup)
- [Firebase Authentication por e-mail/senha](https://firebase.google.com/docs/auth/web/password-auth)
- [Regras de segurança do Firestore](https://firebase.google.com/docs/firestore/security/get-started)
- [Habilitar APIs do Google Workspace](https://developers.google.com/workspace/guides/enable-apis)
- [Upload de arquivos pela Drive API](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables)
