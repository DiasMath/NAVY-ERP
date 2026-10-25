# Estrutura de backend da NAVY

O projeto permanece em **Next.js 15 + React 19 + TypeScript** na Vercel. **Clientes já usa o Firestore** para cadastro, notas e sessões, com atualização em tempo real por unidade. Serviços e Agenda ainda usam dados de demonstração no `localStorage`. O projeto Firebase `navy-erp`, seu app Web e o Firestore existem. O provedor E-mail/senha está ativo, duas contas possuem perfis `master_admin` e `admin`, e as regras deste repositório estão publicadas.

## Organização

- `features/auth/`: estado de sessão, login por e-mail/senha, recuperação de senha e redirecionamento das rotas internas.
- `lib/firebase/config.ts`: configuração pública do aplicativo Web, lida de variáveis `NEXT_PUBLIC_*`.
- `lib/firebase/client.ts`: instância única do SDK Web para Authentication e Firestore.
- `lib/firebase/documents.ts`: formatos persistidos, separados dos modelos ilustrativos da UI.
- `lib/firebase/repositories.ts`: leitura em tempo real e escrita por unidade.
- `features/clients/client-firestore.ts`: adaptação entre documentos Firestore e o modelo da tela.
- `firestore.rules`: isolamento por unidade e permissões iniciais.
- `lib/server/`: Firebase Admin, verificação de sessão e integração OAuth/Drive; usado somente pelas rotas `app/api/`.

## Modelo inicial

```text
users/{uid}                         → nome, clinicId, role, active
clinics/{clinicId}/clients/{id}     → cadastro e preferências
clinics/{clinicId}/services/{id}    → catálogo e disponibilidade por profissional
clinics/{clinicId}/professionals/{id}
clinics/{clinicId}/appointments/{id}→ agenda e snapshot de serviços/preços
clinics/{clinicId}/sessions/{id}    → atendimento clínico realizado
clinics/{clinicId}/clientPhotos/{id}→ metadados e ID privado de foto
clinics/{clinicId}/integrations/drive→ refresh token criptografado e ID da pasta
```

Os agendamentos guardarão `clientId`, `professionalId` e linhas de serviço com preço/duração no momento da marcação. Sessões clínicas da tela de Clientes já ficam em documentos separados e visitas/LTV são calculados a partir delas. A Agenda ainda não lê nem grava esses documentos. A foto de perfil guarda um `avatarDriveFileId` no cadastro, e a galeria guarda metadados em `clientPhotos`; os bytes ficam no Google Drive. O refresh token OAuth é criptografado com AES-GCM e fica no documento de integração, sem leitura pelo SDK Web. Não guardar imagem base64, senha ou token em campos públicos do Firestore.

## Acesso

O formulário de login usa Firebase Authentication quando o app Web está configurado. Depois da autenticação, a NAVY lê `users/{uid}`; apenas um perfil ativo com `clinicId` e papel reconhecido entra nas telas internas. O bloqueio React melhora a experiência, enquanto `firestore.rules` protege o acesso direto aos dados. As rotas de imagem verificam o ID token e o perfil ativo com Firebase Admin antes de ler ou escrever no Drive. Profissionais e recepção podem criar/atualizar clientes, agendamentos e sessões; catálogo, profissionais e exclusões ficam com administradores. A exclusão de clientes passa por uma rota de servidor e exige que suas imagens sejam removidas antes. O primeiro perfil é criado manualmente pelo proprietário no console Firebase, sem autoatribuição de papel pelo navegador.

## Para ativar o Firebase

1. Projeto Firebase `navy-erp` e aplicativo Web: já criados.
2. Authentication com **E-mail/senha** está ativo; as duas primeiras contas foram criadas no console e têm perfis ativos. Para novas contas, crie o usuário no console e seu documento de perfil correspondente. Nenhuma senha é armazenada neste repositório.
3. Banco Cloud Firestore: já criado. Conferir o modo e a localização no console.
4. `firestore.rules` foi publicado no projeto `navy-erp`. Para alterações futuras, teste acessos permitido/negado no Rules Simulator ou Emulator antes de dados reais.
5. Para contas futuras, criar manualmente `users/{uid}` com os campos abaixo, usando o UID do usuário criado no Authentication:

```json
{
  "name": "Administrador NAVY",
  "clinicId": "navy-matriz",
  "role": "master_admin",
  "active": true
}
```

6. Copiar `.env.example` para `.env.local` e preencher com o objeto de configuração do **app Web**. Cadastrar as mesmas variáveis no projeto Vercel e publicar uma nova versão. As variáveis `NEXT_PUBLIC_*` identificam o app; não são credenciais de administrador. Nunca colocar chave de conta de serviço nelas.

## Próximos incrementos

1. Validar um cadastro de teste em Clientes usando uma das contas autorizadas, conferir o documento no console Firestore e excluí-lo ao terminar.
2. Migrar Serviços e profissionais, incluindo as regras de ativação e disponibilidade.
3. Migrar Agenda. A verificação de conflito atual é apenas visual/local; a gravação real precisa de operação atômica no backend para evitar duas reservas simultâneas.
4. Vincular sessões clínicas a profissionais e serviços do catálogo, e tratar exclusão de registros relacionados.
5. Conectar a conta proprietária do Google Drive em **Configurações Gerais → Integrações** e validar foto de perfil, galeria e exclusão em Clientes. As rotas já estão implementadas; a autorização OAuth da proprietária é necessária para ativar o acesso.

Os dados ilustrativos antigos de Clientes no navegador não foram importados automaticamente. A coleção real começa vazia. O controle de telefone duplicado é feito na interface; antes de operação concorrente em escala, precisará de uma garantia no backend. A listagem atual acompanha a coleção completa e precisará de paginação conforme o volume de clientes crescer.
