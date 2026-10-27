# Estrutura de backend da NAVY

O projeto permanece em **Next.js 15 + React 19 + TypeScript** na Vercel. Clientes, Serviços e Agenda usam o Firestore com atualização em tempo real na única unidade NAVY Matriz. O caminho interno `clinics/navy-matriz` preserva os dados existentes; a interface não pede seleção de clínica. A criação e edição de agendamentos passam por uma API autenticada que valida cliente, dados do catálogo e conflitos em transação. O projeto Firebase `navy-erp`, seu app Web e o Firestore existem. O provedor E-mail/senha está ativo. As regras atuais do Firestore já foram publicadas com Clientes.

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

Os agendamentos guardam `clientId`, `bookingKind`, `professionalId` e linhas de atendimento com preço/duração no momento da marcação. O tipo `catalog` exige profissional e serviços ativos. O tipo `manual` permite descrição, duração e valor sem catálogo, com `professionalId` vazio; reservas avulsas simultâneas conflitam entre si na agenda da unidade. A API usa `scheduleLocks` e consulta os compromissos do dia na mesma transação para rejeitar reservas sobrepostas. Depois de concluir um compromisso, a ficha da cliente permite registrar uma sessão preenchida com os dados da reserva. Essa sessão usa o ID do agendamento para impedir duplicação e guarda `appointmentId` e, quando há apenas um procedimento, `serviceId`. Visitas e LTV vêm das sessões; o valor só entra no LTV quando o pagamento é registrado. Um agendamento com sessão vinculada não pode ser remarcado, reaberto ou cancelado antes da exclusão da sessão. Um retorno planejado na ficha ainda não reserva horário: use **Agendar** para criar o compromisso na Agenda. A foto de perfil guarda um `avatarDriveFileId` no cadastro, e a galeria guarda metadados em `clientPhotos`; os bytes ficam no Google Drive. O refresh token OAuth é criptografado com AES-GCM e fica no documento de integração, sem leitura pelo SDK Web.

O campo `paymentMethod` do agendamento é uma intenção de recebimento. O registro de pagamento é `paymentStatus`/`paymentMethod` da sessão clínica; o total recebido da cliente soma apenas sessões com `paymentStatus: "paid"`. A Agenda lê a sessão vinculada para mostrar o valor e o estado reais. Não existe lançamento no módulo Financeiro nem baixa de estoque nesta etapa.

## Acesso

O formulário de login usa Firebase Authentication quando o app Web está configurado. Depois da autenticação, a NAVY lê `users/{uid}`; apenas um perfil ativo com `clinicId` e papel reconhecido entra nas telas internas. `firestore.rules` protege o acesso direto aos dados. A API de agendamentos verifica o ID token e o perfil ativo; o SDK Web só lê agendamentos. Profissionais e recepção podem criar/atualizar clientes, agendamentos e sessões; catálogo, profissionais e exclusões ficam com administradores. A exclusão de clientes passa por uma rota de servidor, exige que suas imagens sejam removidas e que agendamentos futuros sejam cancelados. O primeiro perfil é criado manualmente pelo proprietário no console Firebase.

## Para ativar o Firebase

1. Projeto Firebase `navy-erp` e aplicativo Web: já criados.
2. Authentication com **E-mail/senha** está ativo; as duas primeiras contas foram criadas no console e têm perfis ativos. Para novas contas, crie o usuário no console e seu documento de perfil correspondente. Nenhuma senha é armazenada neste repositório.
3. Banco Cloud Firestore: já criado. Conferir o modo e a localização no console.
4. As regras do Firestore da Agenda já foram publicadas no projeto `navy-erp`. Para mudanças futuras nessas regras, confira no Rules Simulator ou Emulator que membros podem ler `appointments`, mas não escrever diretamente nessa coleção nem em `scheduleLocks`.
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

1. Cadastrar profissionais e serviços reais da NAVY Matriz.
2. Configurar escala e indisponibilidades reais de profissionais. A janela atual da Agenda é de 08:00 a 20:00.
3. Integrar pagamento e baixa de insumos quando os módulos Financeiro e Estoque forem implementados.

Os dados ilustrativos antigos de Clientes no navegador não foram importados automaticamente. A coleção real começa vazia. O controle de telefone duplicado é feito na interface; antes de operação concorrente em escala, precisará de uma garantia no backend. A listagem atual acompanha a coleção completa e precisará de paginação conforme o volume de clientes crescer.
