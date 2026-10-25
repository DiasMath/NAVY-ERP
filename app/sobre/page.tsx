import type { Metadata } from "next";
import Link from "next/link";
import PublicInfoLayout from "@/components/PublicInfoLayout";

export const metadata: Metadata = { title: "Sobre a NAVY ERP", description: "Conheça a NAVY ERP, plataforma de gestão para clínicas de estética." };

export default function AboutPage() {
  return <PublicInfoLayout eyebrow="Plataforma de gestão" title="Gestão de estética com clareza em cada etapa." introduction="A NAVY ERP foi criada para reunir a operação de clínicas de estética em uma experiência simples e organizada.">
    <section><h2>O que a NAVY organiza</h2><p>A plataforma reúne cadastro de clientes, histórico de atendimentos, catálogo de serviços e agenda em uma interface para equipes autorizadas. O objetivo é ajudar a clínica a acompanhar suas rotinas e atender com mais contexto.</p></section>
    <section><h2>Como funciona o acesso</h2><p>O acesso ao sistema é concedido pela administração da clínica. Cada pessoa entra com sua própria conta, e as permissões são definidas de acordo com sua função.</p><p><Link href="/login">Entrar na NAVY ERP</Link></p></section>
    <section><h2>Seus dados</h2><p>As informações de clientes e as imagens enviadas pela clínica são protegidas por controles de acesso. Consulte a <Link href="/privacidade">Política de Privacidade</Link> para entender como a NAVY ERP usa o Firebase e o Google Drive.</p></section>
  </PublicInfoLayout>;
}
