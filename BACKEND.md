# Estrutura de backend da NAVY

O projeto permanece em **Next.js 15 + React 19 + TypeScript** na Vercel. Clientes, Serviços e Agenda usam o Firestore com atualização em tempo real por unidade. A criação e edição de agendamentos passam por uma API autenticada que valida cliente, os dados do catálogo quando usados e conflitos em uma transação. O projeto Firebase `navy-erp`, seu app Web e o Firestore existem. O provedor E-mail/senha está ativo. Publique a versão de `firestore.rules` deste commit junto com a aplicação para impedir gravações diretas de agendamentos pelo navegador.

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
clinics/{clinicId}/scheduleLocks/{id} → serialização por profissional ou agenda avulsa e dia
clinics/{clinicId}/sessions/{id}    → atendimento clínico realizado
clinics/{clinicId}/clientPhotos/{id}→ metadados e ID privado de foto
clinics/{clinicId}/integrations/drive→ refresh token criptografado e ID da pasta
```

Os agendamentos guardam `clientId`, `bookingKind`, `professionalId` e linhas de atendimento com preço/duração no momento da marcação. O tipo `catalog` exige profissional e serviços ativos. O tipo `manual` permite descrição, duração e valor sem catálogo, com `professionalId` vazio; reservas avulsas simultâneas conflitam entre si na agenda da unidade. A API usa `scheduleLocks` e consulta os compromissos do dia na mesma transação para rejeitar reservas sobrepostas. Sessões clínicas da tela de Clientes ficam em documentos separados; visitas/LTV são calculados a partir delas. Um retorno planejado na ficha ainda não reserva horário: use **Agendar** para criar o compromisso na Agenda. A foto de perfil guarda um `avatarDriveFileId` no cadastro, e a galeria guarda metadados em `clientPhotos`; os bytes ficam no Google Drive. O refresh token OAuth é criptografado com AES-GCM e fica no documento de integração, sem leitura pelo SDK Web.

## Acesso

O formulário de login usa Firebase Authentication quando o app Web está configurado. Depois da autenticação, a NAVY lê `users/{uid}`; apenas um perfil ativo com `clinicId` e papel reconhecido entra nas telas internas. `firestore.rules` protege o acesso direto aos dados. A API de agendamentos verifica o ID token e o perfil ativo; o SDK Web só lê agendamentos. Profissionais e recepção podem criar/atualizar clientes, agendamentos e sessões; catálogo, profissionais e exclusões ficam com administradores. A exclusão de clientes passa por uma rota de servidor, exige que suas imagens sejam removidas e que agendamentos futuros sejam cancelados. O primeiro perfil é criado manualmente pelo proprietário no console Firebase.

## Para ativar o Firebase

1. Projeto Firebase `navy-erp` e aplicativo Web: já criados.
2. Authentication com **E-mail/senha** está ativo; as duas primeiras contas foram criadas no console e têm perfis ativos. Para novas contas, crie o usuário no console e seu documento de perfil correspondente. Nenhuma senha é armazenada neste repositório.
3. Banco Cloud Firestore: já criado. Conferir o modo e a localização no console.
4. Publique `firestore.rules` deste commit no projeto `navy-erp` antes de usar a nova Agenda. Confirme no Rules Simulator ou Emulator que membros podem ler `appointments`, mas não escrever diretamente nessa coleção nem em `scheduleLocks`.
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

1. Publicar as regras Firestore atualizadas e testar agendamentos reais com uma conta autorizada, incluindo reserva concorrente, edição, cancelamento e consulta na ficha da cliente.
2. Vincular sessões clínicas concluídas a agendamentos, profissionais e serviços do catálogo.
3. Configurar escala e indisponibilidades reais de profissionais. A janela atual da Agenda é de 08:00 a 20:00.

Os dados ilustrativos antigos de Clientes no navegador não foram importados automaticamente. A coleção real começa vazia. O controle de telefone duplicado é feito na interface; antes de operação concorrente em escala, precisará de uma garantia no backend. A listagem atual acompanha a coleção completa e precisará de paginação conforme o volume de clientes crescer.
