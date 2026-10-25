(() => {
  const page = document.body;
  const embedded = window.self !== window.top;
  if (embedded) page.classList.add('navy-shell-content');
  const sidebar = page.querySelector('aside:first-of-type');
  const header = page.querySelector('div.pl-72 > header');
  const labels = {
    collapsed: 'Expandir menu lateral',
    expanded: 'Recolher menu lateral',
  };
  let activeTrigger = null;
  let activeOverlay = null;
  let toastTimer = null;

  const icon = (name, size = 20) => `<span class="material-symbols-outlined" style="font-size:${size}px">${name}</span>`;
  const buttonLabel = (button) => {
    const copy = button.cloneNode(true);
    copy.querySelectorAll('.material-symbols-outlined').forEach((symbol) => symbol.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };
  const setFocusMode = (enabled) => {
    page.classList.toggle('navy-focus-mode', enabled);
    try { localStorage.setItem('navy-focus-mode', enabled ? '1' : '0'); } catch { /* preview still works */ }
  };
  const announce = (message) => {
    document.querySelector('.navy-ui-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'navy-ui-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    page.append(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 3200);
  };
  const loadFragment = async (name) => {
    const response = await fetch(`/stitch/ui/${name}.html`);
    if (!response.ok) throw new Error(`Não foi possível carregar ${name}`);
    const holder = document.createElement('div');
    holder.innerHTML = await response.text();
    return holder.firstElementChild;
  };
  const closeOverlay = () => {
    activeOverlay?.remove();
    activeOverlay = null;
    document.querySelector('.navy-ui-backdrop')?.remove();
    document.querySelector('.navy-ui-modal-layer')?.remove();
    document.querySelector('#navy-profile-panel')?.remove();
    document.querySelector('#navy-view-drawer')?.remove();
    page.style.overflow = '';
    document.querySelector('.navy-profile-trigger')?.setAttribute('aria-expanded', 'false');
    activeTrigger?.focus?.();
    activeTrigger = null;
  };
  const backdrop = () => {
    const shade = document.createElement('div');
    shade.className = 'navy-ui-backdrop';
    shade.addEventListener('click', closeOverlay);
    page.append(shade);
    return shade;
  };
  const markSensitiveValues = () => {
    page.querySelectorAll('span, strong, p, div').forEach((element) => {
      if (element.children.length === 0 && /^\s*R\$\s*[\d.,]+/.test(element.textContent || '')) {
        element.classList.add('navy-sensitive');
      }
    });
  };

  if (sidebar && !embedded) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'navy-menu-toggle';
    toggle.innerHTML = icon('side_navigation');
    const updateToggle = () => {
      const collapsed = page.classList.contains('navy-menu-collapsed');
      toggle.setAttribute('aria-label', collapsed ? labels.collapsed : labels.expanded);
      toggle.setAttribute('title', collapsed ? labels.collapsed : labels.expanded);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.innerHTML = icon(collapsed ? 'menu_open' : 'left_panel_close');
      sidebar.querySelectorAll('nav a').forEach((link) => {
        if (!link.dataset.navyTitle) link.dataset.navyTitle = link.textContent.replace(/\s+/g, ' ').trim();
        link.title = collapsed ? link.dataset.navyTitle : '';
        link.setAttribute('aria-label', link.dataset.navyTitle);
      });
    };
    try { page.classList.toggle('navy-menu-collapsed', localStorage.getItem('navy-menu-collapsed') === '1'); } catch { /* preview still works */ }
    sidebar.append(toggle);
    toggle.addEventListener('click', () => {
      page.classList.toggle('navy-menu-collapsed');
      try { localStorage.setItem('navy-menu-collapsed', page.classList.contains('navy-menu-collapsed') ? '1' : '0'); } catch { /* preview still works */ }
      updateToggle();
    });
    updateToggle();
  }

  if (header && !embedded) {
    const avatar = header.querySelector('img[alt="Profile"]');
    const trigger = avatar?.parentElement;
    if (trigger) {
      trigger.classList.add('navy-profile-trigger');
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('aria-label', 'Abrir menu do perfil');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      const openProfile = async () => {
        if (document.querySelector('#navy-profile-panel')) { closeOverlay(); return; }
        closeOverlay();
        activeTrigger = trigger;
        try {
          const panel = await loadFragment('profile');
          page.append(panel);
          activeOverlay = panel;
          trigger.setAttribute('aria-expanded', 'true');
          panel.querySelector('input[type="checkbox"]')?.addEventListener('change', (event) => setFocusMode(event.target.checked));
          const focusSwitch = panel.querySelector('input[type="checkbox"]');
          if (focusSwitch) focusSwitch.checked = page.classList.contains('navy-focus-mode');
          panel.querySelectorAll('a[href="#"]').forEach((link) => {
            const text = link.textContent.replace(/\s+/g, ' ').trim();
            if (/Segurança|Chaves|Auditoria/.test(text)) link.href = '/usuarios';
            else link.href = '/configuracoes';
            link.target = '_top';
          });
          Array.from(panel.querySelectorAll('button')).find((button) => /Sair do Sistema/.test(buttonLabel(button)))?.addEventListener('click', () => {
            closeOverlay();
            announce('Prévia visual: a autenticação será implementada na etapa de backend.');
          });
          panel.querySelector('a, button, input')?.focus();
        } catch { announce('Não foi possível abrir o menu do perfil.'); }
      };
      trigger.addEventListener('click', openProfile);
      trigger.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfile(); }
      });
    }
  }

  const reportLink = sidebar?.querySelector('a[data-path="relatorios-e-insights"]');
  reportLink?.querySelectorAll('span').forEach((span) => { if (span.textContent.trim() === 'Em breve') span.remove(); });
  markSensitiveValues();
  try { setFocusMode(localStorage.getItem('navy-focus-mode') === '1'); } catch { /* preview still works */ }

  const setupAppointmentCatalog = (dialog) => {
    let catalog = [];
    let professionals = [{ id: 'camila-navy', name: 'Dra. Camila NAVY' }];
    try {
      const saved = JSON.parse(localStorage.getItem('navy-services-demo-v1') || 'null');
      if (Array.isArray(saved)) catalog = saved.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string').map((item) => ({ ...item, professionalIds: Array.isArray(item.professionalIds) ? item.professionalIds : ['camila-navy'] }));
      const roster = JSON.parse(localStorage.getItem('navy-service-professionals-demo-v1') || 'null');
      if (Array.isArray(roster) && roster.length && roster.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string')) professionals = roster;
    } catch { /* The preview remains usable without browser storage. */ }

    const professionalSelect = dialog.querySelector('[data-navy-appointment-professional]');
    const addSelect = dialog.querySelector('[data-navy-appointment-add-service]');
    const selectedList = dialog.querySelector('[data-navy-appointment-services]');
    const dateInput = dialog.querySelector('[data-navy-appointment-date]');
    const timeInput = dialog.querySelector('[data-navy-appointment-time]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dateInput.min = localDate(new Date());
    dateInput.value = localDate(tomorrow);
    const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const minutes = (value) => { const hours = Math.floor(value / 60); const rest = value % 60; return hours ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${value} min`; };
    let location = 'Studio';
    let selectedIds = [];
    professionals.forEach((item) => professionalSelect.add(new Option(item.name, item.id)));
    const available = () => catalog.filter((item) => item.status === 'Ativo' && item.professionalIds.includes(professionalSelect.value) && (location === 'Home' ? item.modality !== 'Studio' : item.modality !== 'Home'));
    const update = () => {
      const choices = available();
      selectedIds = selectedIds.filter((id) => choices.some((item) => item.id === id));
      addSelect.replaceChildren(new Option(choices.length ? 'Adicionar procedimento disponível' : 'Nenhum serviço disponível', ''));
      choices.filter((item) => !selectedIds.includes(item.id)).forEach((item) => addSelect.add(new Option(`${item.name} · ${minutes(item.durationMinutes)}`, item.id)));
      selectedList.replaceChildren();
      if (!selectedIds.length) {
        const empty = document.createElement('p');
        empty.className = 'font-body-sm text-body-sm text-secondary';
        empty.textContent = 'Nenhum procedimento selecionado.';
        selectedList.append(empty);
      }
      const selected = selectedIds.map((id) => choices.find((item) => item.id === id)).filter(Boolean);
      selected.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'p-3 bg-surface-container-low rounded-xl flex items-center justify-between gap-3';
        const copy = document.createElement('div');
        copy.className = 'flex flex-col min-w-0';
        const name = document.createElement('strong');
        name.className = 'font-label-md text-label-md text-on-surface';
        name.textContent = item.name;
        const detail = document.createElement('span');
        detail.className = 'font-body-sm text-body-sm text-secondary';
        detail.textContent = `Duração: ${minutes(item.durationMinutes)} · ${money(item.price)}`;
        copy.append(name, detail);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error shrink-0';
        remove.setAttribute('aria-label', `Remover ${item.name}`);
        remove.innerHTML = icon('delete_outline', 18);
        remove.addEventListener('click', () => { selectedIds = selectedIds.filter((id) => id !== item.id); update(); });
        row.append(copy, remove);
        selectedList.append(row);
      });
      const total = selected.reduce((sum, item) => sum + Number(item.price || 0), 0);
      const duration = selected.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
      dialog.querySelector('[data-navy-appointment-count]').textContent = String(selected.length);
      dialog.querySelector('[data-navy-appointment-duration]').textContent = duration ? minutes(duration) : 'Selecione serviços';
      const [hour, minute] = timeInput.value.split(':').map(Number);
      const endMinute = hour * 60 + minute + duration;
      dialog.querySelector('[data-navy-appointment-end]').textContent = duration && Number.isFinite(endMinute) ? `Término previsto: ${String(Math.floor(endMinute / 60) % 24).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}${endMinute >= 1440 ? ' (+1 dia)' : ''}` : 'Duração do catálogo';
      dialog.querySelector('[data-navy-appointment-total]').textContent = money(total);
      dialog.querySelector('[data-navy-appointment-deposit]').textContent = money(total * 0.3);
      dialog.querySelector('[data-navy-appointment-balance]').textContent = money(total * 0.7);
    };
    professionalSelect.addEventListener('change', update);
    timeInput.addEventListener('change', update);
    addSelect.addEventListener('change', () => { if (addSelect.value) { selectedIds.push(addSelect.value); update(); } });
    dialog.querySelectorAll('[data-navy-appointment-location]').forEach((button) => button.addEventListener('click', () => {
      location = button.dataset.navyAppointmentLocation;
      dialog.querySelector('[data-navy-appointment-place]').textContent = location === 'Home' ? 'Atendimento Domiciliar VIP' : 'Cabine Master VIP 01 • Andar Jardins';
      dialog.querySelectorAll('[data-navy-appointment-location]').forEach((other) => {
        const active = other === button;
        other.setAttribute('aria-pressed', String(active));
        other.classList.toggle('bg-surface-container-lowest', active);
        other.classList.toggle('shadow-sm', active);
        other.classList.toggle('text-primary', active);
      });
      update();
    }));
    update();
    return () => {
      if (!selectedIds.length) return 'Selecione pelo menos um serviço disponível.';
      if (!dateInput.value || !timeInput.value || new Date(`${dateInput.value}T${timeInput.value}`) <= new Date()) return 'Escolha uma data e um horário futuros.';
      return null;
    };
  };

  const openAppointmentModal = async (trigger) => {
    closeOverlay();
    activeTrigger = trigger;
    backdrop();
    const layer = document.createElement('div');
    layer.className = 'navy-ui-modal-layer';
    page.append(layer);
    page.style.overflow = 'hidden';
    try {
      const dialog = await loadFragment('appointment-modal');
      layer.append(dialog);
      activeOverlay = dialog;
      dialog.querySelector('button[aria-label="Fechar"]')?.addEventListener('click', closeOverlay);
      const validateAppointment = setupAppointmentCatalog(dialog);
      dialog.querySelectorAll('button').forEach((button) => {
        const label = buttonLabel(button);
        if (/Salvar Rascunho|Revisar agendamento/.test(label)) button.addEventListener('click', () => {
          const issue = validateAppointment();
          if (issue) { announce(issue); return; }
          closeOverlay();
          announce('Prévia visual: o agendamento ainda não foi salvo.');
        });
      });
      dialog.querySelector('button[aria-label="Fechar"]')?.focus();
    } catch { closeOverlay(); announce('Não foi possível abrir o agendamento.'); }
  };

  const openViewDrawer = (trigger) => {
    closeOverlay();
    activeTrigger = trigger;
    backdrop();
    page.style.overflow = 'hidden';
    const drawer = document.createElement('aside');
    drawer.id = 'navy-view-drawer';
    drawer.className = 'fixed top-16 right-0 bottom-0 w-[530px] max-w-full bg-surface-container-lowest shadow-2xl z-50 flex flex-col overflow-hidden';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Detalhes do item selecionado');
    drawer.innerHTML = `
      <div class="p-space-lg bg-surface-container-lowest shadow-[0_1px_4px_rgba(0,0,0,0.03)] flex flex-col gap-3 relative z-10">
        <div class="flex items-start justify-between"><div class="flex flex-col"><span class="font-headline-md text-headline-md text-on-surface font-semibold">Detalhes do Atendimento</span><span class="font-label-sm text-label-sm text-outline tracking-wider uppercase mt-1">NAVY Clinical ERP • Prévia de consulta</span></div><button type="button" class="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors" aria-label="Fechar painel">${icon('close')}</button></div>
        <div class="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl"><button type="button" class="navy-drawer-tab flex-1 py-1 px-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5" aria-selected="true">${icon('info',16)} Visão Geral</button><button type="button" class="navy-drawer-tab flex-1 py-1 px-2 rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-1.5" aria-selected="false">${icon('clinical_notes',16)} Anamnese</button><button type="button" class="navy-drawer-tab flex-1 py-1 px-2 rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-1.5" aria-selected="false">${icon('history_edu',16)} Histórico</button></div>
      </div>
      <div class="navy-drawer-content" data-navy-drawer-body></div>
      <div class="p-space-lg bg-surface-container-lowest shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex items-center justify-between gap-space-md"><button type="button" class="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors" data-navy-close>Fechar</button><button type="button" class="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary/90 shadow-md transition-all" data-navy-appointment>${icon('calendar_add_on',18)} Novo Agendamento</button></div>`;
    const source = trigger.matches('button') ? trigger.parentElement?.parentElement : trigger;
    const lines = (source?.innerText || trigger.textContent).split('\n').map((line) => line.trim()).filter(Boolean);
    const nameValue = lines.find((line) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]+){1,4}$/u.test(line)) || 'Atendimento selecionado';
    const service = lines.find((line) => /Lash|Extensão|Manutenção|Volume|Design|Peeling|Botox|Lifting/i.test(line) && line !== nameValue) || 'Procedimento em análise';
    const amount = lines.filter((line) => /^R\$\s*[\d.,]+/.test(line)).at(-1) || 'Valor a confirmar';
    const status = lines.find((line) => /^(Concluído|Confirmado|Em Atendimento|Em Andamento|Pendente)/i.test(line)) || 'Agendado';
    const location = lines.find((line) => /^(Studio|Domicílio)/i.test(line)) || 'Unidade Matriz';
    const body = drawer.querySelector('[data-navy-drawer-body]');
    const renderTab = (name) => {
      body.replaceChildren();
      if (name === 'Visão Geral') {
        const identity = document.createElement('section');
        identity.className = 'navy-drawer-card navy-drawer-identity';
        identity.innerHTML = `<div class="navy-drawer-avatar">${icon('person',24)}</div><div><h3></h3><p></p></div>`;
        identity.querySelector('h3').textContent = nameValue;
        identity.querySelector('p').textContent = `${status} • ${location}`;
        const procedure = document.createElement('section');
        procedure.className = 'navy-drawer-card';
        procedure.innerHTML = `<span class="navy-drawer-eyebrow">PROCEDIMENTO</span><h3></h3><p></p><strong class="navy-drawer-amount"></strong>`;
        procedure.querySelector('h3').textContent = service;
        procedure.querySelector('p').textContent = 'Dados ilustrativos da tela selecionada';
        procedure.querySelector('strong').textContent = amount;
        body.append(identity, procedure);
      } else {
        const card = document.createElement('section');
        card.className = 'navy-drawer-card';
        const title = document.createElement('h3');
        title.textContent = name;
        const description = document.createElement('p');
        description.textContent = 'Esta seção será conectada ao prontuário quando os dados reais forem implementados.';
        card.append(title, description);
        body.append(card);
      }
    };
    drawer.querySelectorAll('.navy-drawer-tab').forEach((tab) => tab.addEventListener('click', () => {
      drawer.querySelectorAll('.navy-drawer-tab').forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
      renderTab(buttonLabel(tab));
    }));
    drawer.querySelector('[aria-label="Fechar painel"]').addEventListener('click', closeOverlay);
    drawer.querySelector('[data-navy-close]').addEventListener('click', closeOverlay);
    drawer.querySelector('[data-navy-appointment]').addEventListener('click', () => openAppointmentModal(trigger));
    page.append(drawer);
    activeOverlay = drawer;
    renderTab('Visão Geral');
    drawer.querySelector('[aria-label="Fechar painel"]').focus();
  };

  const openCompletionDrawer = async (trigger) => {
    closeOverlay();
    activeTrigger = trigger;
    backdrop();
    page.style.overflow = 'hidden';
    try {
      const drawer = await loadFragment('drawer');
      page.append(drawer);
      activeOverlay = drawer;
      drawer.querySelector('#closeDrawerBtn')?.addEventListener('click', closeOverlay);
      drawer.querySelector('#copyPixBtn')?.addEventListener('click', () => announce('Prévia visual: nenhuma cobrança foi gerada.'));
      drawer.querySelector('#finishPaymentBtn')?.addEventListener('click', () => {
        closeOverlay();
        announce('Prévia visual: o atendimento ainda não foi finalizado.');
      });
      drawer.querySelectorAll('button').forEach((button) => {
        if (/Salvar Rascunho/.test(buttonLabel(button))) button.addEventListener('click', () => {
          closeOverlay();
          announce('Prévia visual: o rascunho ainda não foi salvo.');
        });
      });
      drawer.querySelector('a[title="Contato indisponível nesta prévia"]')?.addEventListener('click', (event) => event.preventDefault());
      drawer.querySelector('#closeDrawerBtn')?.focus();
    } catch { closeOverlay(); announce('Não foi possível abrir o painel de atendimento.'); }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const completion = button && /^(Concluir Atendimento|Finalizar Atendimento)$/.test(buttonLabel(button));
    if (completion) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openCompletionDrawer(button);
      return;
    }
    const appointment = button && (button.id === 'btn-novo-agendamento' || /^(\+\s*)?Novo Agendamento(?: Clínico)?$/.test(buttonLabel(button)));
    if (appointment) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAppointmentModal(button);
      return;
    }
    const viewButton = button && /^(Ver Ficha|Ficha Clínica|Ver Anamnese|Detalhes do Trajeto)$/.test(buttonLabel(button));
    const appointmentCard = location.pathname.endsWith('/agenda.html') && event.target.closest('main .group.cursor-pointer')?.querySelector('img');
    if (viewButton || appointmentCard) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openViewDrawer(viewButton ? button : appointmentCard.closest('main .group.cursor-pointer'));
      return;
    }
    if (document.querySelector('#navy-profile-panel') && !event.target.closest('#navy-profile-panel, .navy-profile-trigger')) closeOverlay();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (activeOverlay || document.querySelector('.navy-ui-backdrop'))) { event.preventDefault(); closeOverlay(); }
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'navy-focus-mode') return;
    setFocusMode(Boolean(event.data.enabled));
  });
})();
