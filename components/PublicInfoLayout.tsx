import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./public-info.module.css";

type Props = {
  eyebrow: string;
  title: string;
  introduction: string;
  children: ReactNode;
};

export default function PublicInfoLayout({ eyebrow, title, introduction, children }: Props) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/sobre" className={styles.brand} aria-label="NAVY ERP — página inicial"><span>N</span><strong>NAVY <small>ERP</small></strong></Link>
      <nav aria-label="Navegação pública" className={styles.navigation}>
        <Link href="/sobre">Sobre</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link><Link href="/login" className={styles.signIn}>Entrar</Link>
      </nav>
    </header>
    <main className={styles.main}>
      <div className={styles.intro}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{introduction}</p></div>
      <article className={styles.content}>{children}</article>
    </main>
    <footer className={styles.footer}><span>NAVY ERP · Matheus Dias</span><span><Link href="/privacidade">Política de Privacidade</Link> · <Link href="/termos">Termos de Uso</Link> · <a href="mailto:datamatsolucoes@gmail.com">Contato</a></span></footer>
  </div>;
}
