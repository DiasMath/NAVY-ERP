"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthProvider";

const slides = [
  { src: "/images/login/reception.png", alt: "Recepção de clínica de estética em tons creme e azul marinho" },
  { src: "/images/login/consultation.png", alt: "Sala de atendimento com detalhes em azul marinho e dourado" },
  { src: "/images/login/lounge.png", alt: "Lounge de clínica de estética com decoração acolhedora" },
  { src: "/images/login/corridor.png", alt: "Corredor de clínica de estética com arcos e iluminação suave" },
  { src: "/images/login/waiting-room.png", alt: "Sala de espera de clínica de estética com luz natural" },
];

function nextPath() {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/login") ? requested : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const { status, error: accessError, signIn, resetPassword } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (status === "authenticated") router.replace(nextPath()); }, [router, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => setActiveSlide(index => (index + 1) % slides.length), 6500);
    return () => window.clearTimeout(timer);
  }, [activeSlide]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(""); setBusy(true);
    try { await signIn(email.trim(), password, remember); }
    catch { setMessage("Não foi possível entrar. Confira e-mail e senha ou tente novamente."); }
    finally { setBusy(false); }
  };
  const recover = async () => {
    if (!email.includes("@")) { setMessage("Informe seu e-mail cadastrado para recuperar a senha."); return; }
    setBusy(true); setMessage("");
    try { await resetPassword(email.trim()); setMessage("Se a conta existir, enviaremos as instruções de recuperação."); }
    catch { setMessage("Não foi possível solicitar a recuperação agora."); }
    finally { setBusy(false); }
  };

  return <main className="navy-login">
    <section className="navy-login-editorial" aria-label="NAVY Clinical ERP">
      <div className="navy-login-carousel" aria-roledescription="carrossel" aria-label="Ambientes NAVY">
        {slides.map((slide, index) => <div key={slide.src} className={`navy-login-slide${index === activeSlide ? " is-active" : ""}`} aria-hidden={index !== activeSlide}>
          <Image src={slide.src} alt={slide.alt} fill sizes="(min-width: 1280px) 52vw, 50vw" priority={index === 0} className="navy-login-hero" />
        </div>)}
      </div>
      <div className="navy-login-hero-gradient" /><div className="navy-login-hero-light" />
      <header className="navy-login-editorial-top"><span className="navy-login-glass"><i />NAVY Clinical ERP • Plataforma Operacional &amp; Financeira</span></header>
      <div className="navy-login-editorial-copy"><div><span className="navy-login-kicker">Excelência Clínica • Studio Matriz</span><h1>Precisão clínica, rentabilidade e acolhimento em cada detalhe.</h1><p>O ecossistema inteligente sob medida para especialistas em estética avançada e gestão de alto padrão.</p></div><footer><ShieldCheck size={18} strokeWidth={1.8} /><span>Uma experiência integrada para cuidar de toda a operação.</span></footer></div>
    </section>

    <section className="navy-login-auth" aria-label="Acesso à NAVY"><div className="navy-login-content">
      <header className="navy-login-form-header"><div className="navy-login-brand-row"><div className="navy-login-brand"><span className="navy-login-mark">N</span><span><strong>NAVY</strong><small>Clinical ERP</small></span></div></div><div className="navy-login-welcome"><h2>Bem-vinda de volta</h2><p>Acesse seu painel com seu e-mail e senha.</p></div></header>

      <form className="navy-login-form" onSubmit={submit}><div className="navy-login-field"><label htmlFor="corporate-email">E-mail</label><div className="navy-login-input-wrap"><AtSign size={17} strokeWidth={1.8} /><input id="corporate-email" type="email" autoComplete="username" placeholder="seuemail@empresa.com.br" value={email} onChange={event => setEmail(event.target.value)} required /></div></div><div className="navy-login-field"><label htmlFor="login-password">Senha de acesso</label><div className="navy-login-input-wrap"><LockKeyhole size={17} strokeWidth={1.8} /><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" className="navy-login-eye" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div><div className="navy-login-form-aux"><label><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Lembrar de mim neste dispositivo</span></label><button type="button" onClick={recover}>Esqueci minha senha</button></div><button className="navy-login-submit" type="submit" disabled={busy || status === "loading"}><span>Entrar no NAVY</span><ArrowRight size={17} /></button></form>

      {(message || accessError) && <div className="navy-login-message" role="status">{message || accessError}</div>}
      <footer className="navy-login-footer"><div><LockKeyhole size={15} /><span>NAVY Clinical ERP • Versão 1</span></div></footer>
    </div></section>
  </main>;
}
