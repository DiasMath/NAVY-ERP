import type { Metadata } from "next";
import PublicInfoLayout from "@/components/PublicInfoLayout";

export const metadata: Metadata = { title: "Termos de Uso | NAVY ERP", description: "Condições de acesso e uso da plataforma NAVY ERP." };

export default function TermsPage() {
  return <PublicInfoLayout eyebrow="Atualizados em 25 de outubro de 2026" title="Termos de Uso" introduction="Estas condições orientam o acesso à NAVY ERP, plataforma de gestão para operações de estética mantida por Matheus Dias.">
    <section><h2>Acesso autorizado</h2><p>A NAVY ERP é destinada a profissionais e equipes autorizados pela administração da clínica. Cada pessoa deve usar sua própria conta e manter suas credenciais protegidas. O acesso e as funções disponíveis dependem do perfil atribuído pela administração.</p></section>
    <section><h2>Informações inseridas</h2><p>A clínica e seus usuários autorizados são responsáveis pela exatidão dos registros inseridos e por obter as autorizações necessárias para cadastrar dados pessoais, observações e imagens de clientes. As informações devem ser usadas apenas para as atividades da clínica.</p></section>
    <section><h2>Integrações</h2><p>A conexão com o Google Drive é opcional e deve ser autorizada pelo titular da conta Google escolhida. A NAVY ERP usa essa permissão para guardar e recuperar as imagens enviadas pela clínica. O titular pode revogar a autorização nas configurações de sua conta Google.</p></section>
    <section><h2>Privacidade e contato</h2><p>O tratamento dos dados está descrito na <a href="/privacidade">Política de Privacidade</a>. Para dúvidas sobre acesso, uso ou dados, escreva para <a href="mailto:datamatsolucoes@gmail.com">datamatsolucoes@gmail.com</a>.</p></section>
  </PublicInfoLayout>;
}
