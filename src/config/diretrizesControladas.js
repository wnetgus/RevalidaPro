// ─── CAMADA DE DIRETRIZES CONTROLADAS — RevalidaPRO ─────────────────────────
// Cada entrada representa um tema sensível com:
//   - palavrasChave: detectadas no tema_mestre + subtema selecionados
//   - fonte / ano: injetados no prompt e sobrescritos no documento Firestore
//   - pontosCriticos: bloco obrigatório enviado ao modelo antes da geração
//
// Detecção automática em gerarViaIA — a IA nunca inventa diretriz quando há
// uma entrada ativa correspondente ao tema.

export const DIRETRIZES_CONTROLADAS = [
  // ── 1. HIPERTENSÃO ARTERIAL SISTÊMICA ──────────────────────────────────────
  {
    id: "has",
    tema: "Hipertensão Arterial Sistêmica",
    palavrasChave: [
      "hipertensão", "has", "pressão arterial", "anti-hipertensivo",
      "crise hipertensiva", "emergência hipertensiva", "urgência hipertensiva",
      "nitroprussiato", "anti hipertensiv",
    ],
    fonte: "7ª Diretriz Brasileira de Hipertensão Arterial — SBC/SBH 2024",
    ano: 2024,
    titulo: "Diretriz Brasileira de Hipertensão Arterial — 2025 (atualização da 7ª Diretriz)",
    orgao: "Sociedade Brasileira de Cardiologia (SBC) / Sociedade Brasileira de Hipertensão (SBH) / Sociedade Brasileira de Nefrologia (SBN)",
    urlOficial: "https://abccardiol.org/en/article/brazilian-guidelines-of-hypertension-2025/",
    versao: "Edição 2025",
    anoPublicacao: 2025,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // Fase 3: PDF oficial 2025 integral baixado e lido (154 pag., Arq Bras Cardiol e20250624) — classificacao/monoterapia/gestante/nitroprussiato CONFIRMADOS e corrigidos com citacao direta; emergencia/urgencia/DRC/DCV/divergencias internacionais NAO releidos nesta sessao — fechamento PARCIAL, nao pronta para validacao integral
    validadeOuProximaRevisao: "seções já lidas (classificação, monoterapia, gestante, agentes IV em gestante) podem ser validadas; emergência/urgência hipertensiva, DRC, DM, DCV e divergências SBC×MS×internacional ainda precisam de leitura dirigida antes de fechar a diretriz inteira",
    observacoes: "Fase 3 (2026-07-24): PDF oficial da Diretriz 2025 (Arq Bras Cardiol. 2025;122(9):e20250624, DOI 10.36660/abc.20250624) baixado de https://static.poder360.com.br/2025/09/2025-0624_Diretriz_Hipertensao_2025_port.x66747.pdf e lido na íntegra (154 páginas, ~687 mil caracteres extraídos). ATENÇÃO — achado importante de auditoria: uma primeira tentativa baixou por engano o PDF de https://www.sbh.org.br/.../VII-Diretrizes-Brasileiras-HA.pdf, que se revelou ser a 7ª Diretriz ORIGINAL DE 2016 (Arq Bras Cardiol 2016;107(3)), não a edição 2025 — descartado antes de qualquer uso, documentado aqui para transparência. CORREÇÕES CONFIRMADAS por citação direta (Quadro 3.2/14.1): a classificação de PA mudou de patamar (o que era 'HAS Estágio 1' em 130-139/80-89 agora é 'Pré-hipertensão'; novo 'HA Estágio 3' ≥180/110 não existia antes) — já corrigido em pontosCriticos. Tratamento gestacional também corrigido (metildopa/BCC di-hidropiridínico, não labetalol/hidralazina como 1ª linha crônica). Emergência/urgência hipertensiva, DRC, DM, DCV, idosos (detalhe) e divergências SBC×MS×internacional NÃO foram relidos linha a linha nesta sessão — fechamento é PARCIAL. Distinção pedida (conduta Revalida/SUS vs. recomendação complementar de sociedade vs. sem consenso único) não foi feita nesta sessão por falta de tempo de leitura dirigida — pendência explícita.",
    temasRelacionados: ["R001", "R046", "R101"],
    pontosCriticos: [
      "Meta pressórica geral: PA < 130/80 mmHg para a maioria dos adultos com HAS (confirmado por leitura direta da Diretriz 2025, Arq Bras Cardiol. 2025;122(9):e20250624)",
      "CLASSIFICAÇÃO CORRIGIDA (Fase 3, leitura direta, Quadro 3.2/14.1 da Diretriz 2025 — SUBSTITUI a classificação 2024 anterior, que usava limiares diferentes): PA normal <120 e <80 | Pré-hipertensão 120-139 e/ou 80-89 | HA Estágio 1: 140-159 e/ou 90-99 | HA Estágio 2: 160-179 e/ou 100-109 | HA Estágio 3 (nova categoria): ≥180 e/ou 110. ATENÇÃO: o que a versão anterior chamava de 'HAS Estágio 1' (130-139/80-89) agora é 'Pré-hipertensão', não hipertensão — não usar os limiares antigos",
      "Monoterapia indicada para: indivíduos frágeis, ≥80 anos, PA ≥130/80 mmHg de risco alto, ou HA Estágio 1 de risco baixo (a critério médico) — demais casos combinação preferencialmente em comprimido único (citação direta, Diretriz 2025)",
      "Metas e seguimento: MAPA ou MRPA sempre que possível para avaliar fenótipos de HA; revisão a cada 4 semanas até atingir a meta; combater inércia terapêutica (citação direta, Diretriz 2025)",
      "1ª linha: IECA (enalapril, captopril) OU BRA OU BCC (anlodipino) OU tiazídico (clortalidona/HCTZ) — não confirmado se a Diretriz 2025 alterou esta recomendação especificamente (não relido linha a linha)",
      "Emergência hipertensiva: PA elevada + LOA aguda (encefalopatia, AVC, EAP, IAM, dissecção) → UTI + droga IV + redução PAM ≤25% na 1ª hora — não relido linha a linha na edição 2025 nesta sessão",
      "Agentes IV de escolha: nitroprussiato (geral, uso IV máx. 4h em gestante pelo risco de impregnação fetal por cianeto — confirmado por leitura direta), nicardipina (AVC), labetalol/hidralazina (dissecção) — nitroglicerina IV também citada para EAP/HA grave refratária em gestante (achado novo, leitura direta)",
      "Urgência hipertensiva: PA muito elevada SEM LOA → redução gradual em 24–48h com VO (captopril, clonidina) — não relido linha a linha na edição 2025",
      "PROIBIDO: nifedipino sublingual (queda abrupta = AVC/IAM isquêmico) — distinto de nifedipina de longa duração, que É recomendada na gestação (ver abaixo)",
      "GESTANTE — CORRIGIDO (Fase 3, leitura direta, recomendação FORTE/BAIXA certeza): iniciar tratamento com metildopa OU bloqueador de canal de cálcio di-hidropiridínico (nifedipina de LONGA DURAÇÃO ou anlodipino) — a versão anterior cadastrada citava labetalol/hidralazina como 1ª linha de tratamento crônico na gestação, mas a Diretriz 2025 não os coloca nessa posição (labetalol/hidralazina aparecem associados a manejo de emergência/dissecção, não ao início do tratamento crônico gestacional). IECA/BRA seguem contraindicados na gestação (não contestado nesta leitura)",
      "Sulfato de magnésio: prevenção e tratamento de eclâmpsia em gestante com HA grave sintomática (confirmado por leitura direta)",
      "Síndrome metabólica e DM: alvo < 130/80 mmHg; preferir IECA ou BRA (nefroproteção) — não relido linha a linha na edição 2025",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 2. DIABETES MELLITUS ───────────────────────────────────────────────────
  {
    id: "dm",
    tema: "Diabetes Mellitus",
    palavrasChave: [
      "diabetes", "dm tipo", "insulina", "glicemia", "hemoglobina glicada",
      "hba1c", "cetoacidose", "hiperglicemia", "hipoglicemia", "metformina",
      "isglt2", "glp1", "dapagliflozina", "empagliflozina", "semaglutida",
      "dm gestacional", "estado hiperosmolar",
    ],
    fonte: "Diretrizes da Sociedade Brasileira de Diabetes (SBD) 2024–2025",
    ano: 2024,
    titulo: "Diretriz da Sociedade Brasileira de Diabetes — Edição 2025 (manejo da terapia antidiabética no DM2)",
    orgao: "Sociedade Brasileira de Diabetes (SBD)",
    urlOficial: "https://diretriz.diabetes.org.br/manejo-da-terapia-antidiabetica-no-dm2-2/",
    versao: "Edição 2025",
    anoPublicacao: 2025,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PRONTA_PARA_VALIDACAO_HUMANA", // Fase 2: texto oficial integral lido e verificado — ver DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md
    validadeOuProximaRevisao: "revisar em até 90 dias — confirmar linha a linha contra diretriz.diabetes.org.br (Ed. 2025, capítulos de tratamento/rastreio)",
    observacoes: "Auditoria 2026-07-24 confirmou mudança clínica real: metformina NÃO É MAIS exclusividade universal de 1ª linha desde a atualização SBD de julho/2025 — pontoCritico abaixo já corrigido para refletir a condicionalidade por perfil de risco. Demais pontos (metas, CAD/EHH, hipoglicemia) não foram comparados linha a linha ao documento primário.",
    temasRelacionados: ["R003", "R004", "R047", "R102"],
    pontosCriticos: [
      "Diagnóstico: GJ ≥126 mg/dL (×2) | TTOG 2h ≥200 mg/dL | HbA1c ≥6,5% | Glicemia aleatória ≥200 + sintomas",
      "Pré-diabetes: GJ 100–125 mg/dL | TTOG 2h 140–199 mg/dL | HbA1c 5,7–6,4%",
      "Meta HbA1c geral: <7,0%; idosos frágeis ou múltiplas comorbidades: <8,0%; gestantes: <6,0%",
      "DM2 — 1ª linha CONDICIONAL (SBD 2025, correção pós-auditoria 2026-07-24): metformina em monoterapia é 1ª escolha SOMENTE em adultos com risco cardiovascular baixo/intermediário, sem tratamento prévio, sem doença cardiorrenal/obesidade/sobrepeso e HbA1c <7,5%. Fora desse perfil, a escolha da 1ª linha é individualizada por risco CV/renal/IMC/HbA1c — NÃO presumir metformina universal",
      "DM2 + DCV estabelecida ou alto risco CV: adicionar iSGLT2 (empagliflozina/dapagliflozina) ou aGLP1 (semaglutida/liraglutida)",
      "DM2 + IRC (TFG 30–60): preferir iSGLT2; suspender metformina se TFG < 30",
      "DM2 + IC com fração reduzida: iSGLT2 é mandatório (reduz hospitalização e mortalidade)",
      "CAD: glicose >250 + cetonemia/cetonúria + bicarbonato <18 + pH <7,3 | Tratamento: SF 0,9% + insulina regular IV 0,1 U/kg/h (aguardar K+ ≥3,5 para iniciar insulina) + reposição de K+ + corrigir causa",
      "EHH (Estado Hiperosmolar Hiperglicêmico): glicose >600 + osmolaridade >320 + desidratação grave, sem cetoacidose significativa → hidratação agressiva",
      "Hipoglicemia grave (<54 mg/dL): glucagon IM 1 mg OU glicose IV (SG 50%: 25–50 mL em adultos)",
      "Rastreamento DM2 SUS: a partir de 35 anos ou qualquer idade com: obesidade, HAS, dislipidemia, histórico familiar, DMG prévio",
      "DM Gestacional (TTOG 75g, 24–28 semanas): GJ ≥92 | 1h ≥180 | 2h ≥153 mg/dL (critério HAPO/OMS 2013)",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 3. SEPSE ───────────────────────────────────────────────────────────────
  {
    id: "sepse",
    tema: "Sepse",
    palavrasChave: [
      "sepse", "choque séptico", "bacteremia", "sepsis",
      "disfunção orgânica", "lactato", "norepinefrina", "noradrenalina",
      "surviving sepsis", "qsofa", "sofa",
    ],
    fonte: "Surviving Sepsis Campaign Guidelines 2021 + AMIB 2022",
    ano: 2022,
    pontosCriticos: [
      "Definição Sepse-3 (2016): disfunção orgânica ameaçadora à vida causada por resposta desregulada à infecção — NÃO mais SIRS",
      "Choque Séptico (Sepse-3): sepse + vasopressor para manter PAM ≥65 mmHg + lactato >2 mmol/L apesar de ressuscitação adequada",
      "qSOFA (triagem fora da UTI): FR ≥22 | Glasgow ≤13 | PAS ≤100 — sensibilidade limitada, não substitui SOFA",
      "Hour-1 Bundle (SSC 2021): colher hemoculturas (×2) → iniciar ATB IV de amplo espectro em até 1 hora → medir lactato → cristaloides 30 mL/kg se lactato >4 ou hipotensão → vasopressor se PAM <65 após ressuscitação",
      "Antibioticoterapia: iniciar em até 1h do diagnóstico — descalonar após cultura e antibiograma",
      "Vasopressor 1ª escolha: Norepinefrina (noradrenalina) → alvo PAM ≥65 mmHg",
      "Vasopressina 0,03 U/min: adicionar à norepinefrina para reduzir dose ou se refratária",
      "Corticoide (hidrocortisona 200 mg/dia IV): somente em choque refratário após norepinefrina + vasopressina adequadas",
      "Controle glicêmico: alvo 140–180 mg/dL → insulina em infusão se glicose >180 mg/dL",
      "Nutrição enteral precoce: 24–48h se trato GI funcionante",
      "PROIBIDO: usar critérios SIRS como definição de sepse (superados pela Sepse-3)",
      "PROIBIDO: usar dopamina como vasopressor de 1ª escolha (maior risco de arritmia e mortalidade vs norepinefrina)",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 4. ASMA ────────────────────────────────────────────────────────────────
  {
    id: "asma",
    tema: "Asma",
    palavrasChave: [
      "asma", "broncoespasmo", "crise asmática", "salbutamol",
      "beta-agonista", "corticoide inalatório", "gina", "saba", "laba",
      "budesonida", "formoterol", "beclometasona",
    ],
    fonte: "GINA 2024 (Global Initiative for Asthma) + SBPT 2023",
    ano: 2024,
    pontosCriticos: [
      "GINA 2024 — Track 1 preferencial: CI+formoterol (baixa dose) conforme necessário desde Step 1 (sem SABA isolado)",
      "GINA 2024 PROÍBE SABA isolado como CONTROLADOR/MANUTENÇÃO diária (substituído por CI+formoterol) — risco aumentado de morte por asma quando usado como único tratamento de manutenção. ISSO NÃO SE APLICA ao alívio agudo durante uma crise: no atendimento da crise/exacerbação, SABA (com ou sem ipratrópio associado em crise grave) continua sendo a terapia de resgate padrão — não confundir a proibição de manutenção com a conduta na crise aguda",
      "Classificação de controle: Controlada (nenhum critério) | Parcialmente controlada (1–2 critérios) | Não controlada (3–4 critérios)",
      "Step 1: CI+formoterol baixa dose PRN | Step 2: CI baixa dose diária + SABA PRN | Step 3: CI/LABA baixa-média dose | Step 4: CI/LABA alta dose | Step 5: add-on biológico (omalizumabe, mepolizumabe, benralizumabe, dupilumabe)",
      "Crise leve-moderada: SABA (salbutamol 2–4 puffs) a cada 20 min × 3; corticoide sistêmico se sem melhora em 1h",
      "Crise grave (SpO2 <92%, FR >30, fala em palavras): O2 alvo 93–95%, SABA+ipratrópio nebulizados, corticoide IV/VO, sulfato de magnésio IV 2g em 20 min",
      "Iminência de parada (cianose, exaustão, Glasgow cair): intubação imediata — ventilação com alta PEEP + baixa FR (asma = armadilha de ar)",
      "Asma na gestante: tratar normalmente — risco do broncoespasmo não tratado supera qualquer risco medicamentoso",
      "Monitorização: PFE (pico de fluxo expiratório) — <50% do predito = crise grave",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 5. RASTREAMENTO DO CÂNCER DE COLO DO ÚTERO ────────────────────────────
  {
    id: "rastreamento_colo",
    tema: "Rastreamento do Câncer de Colo do Útero",
    palavrasChave: [
      // Hotfix pós-Lote 001: removida a palavra-chave "nio" — substring de 3
      // letras que casava dentro de "cranioencefálico" e injetava esta
      // diretriz (colo do útero) em questões de TCE. "nic" tem o mesmo risco
      // (casa dentro de "clínica", "crônica", "técnica" etc.) — mantido por
      // ora pois já havia dependência dele, mas reportado como risco
      // equivalente ainda pendente (ver auditoria no relatório do hotfix).
      "colo uterino", "colo do útero", "papanicolau", "colpocitologia",
      "hpv", "cervical", "nic", "rastreamento cervical",
      "colposcopia", "asc-us", "lsil", "hsil", "asc-h",
    ],
    fonte: "INCA 2023 — Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero (2ª edição)",
    ano: 2023,
    titulo: "Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero — Volume 1: Rastreamento organizado com teste molecular para detecção de DNA-HPV oncogênico",
    orgao: "Ministério da Saúde / INCA / CONITEC",
    urlOficial: "https://www.gov.br/conitec/pt-br/midias/protocolos/diretrizes/diretriz-brasileira-rastreamento-do-cancer-do-colo-do-utero-diretriz-brasileira",
    versao: "Volume 1, publicada 18/08/2025 (Portaria SAES/SECTICS nº 13/2025, Diário Oficial da União)",
    anoPublicacao: 2025,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // Fase 3: PDF oficial 3a edicao 2025 (INCA/MS) integral lido (98 pag., ~250 mil caracteres) — populacao-alvo/sintomatica/histerectomia/imunossuprimidas CONFIRMADOS por numero de recomendacao; fluxo ASC-US/LSIL/HSIL por citologia e conduta se DNA-HPV indisponivel NAO relidos — fechamento PARCIAL
    validadeOuProximaRevisao: "fluxo de citologia reflexa (ASC-US/LSIL/HSIL) e conduta operacional quando DNA-HPV está indisponível na rede ainda precisam de leitura dirigida antes de fechar a diretriz inteira",
    observacoes: "Fase 3 (2026-07-24): PDF oficial (Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero, 3ª edição revista/ampliada/atualizada, INCA/MS, 2025 — 1ª ed. 2011, 2ª ed. 2016) baixado de https://ninho.inca.gov.br/jspui/bitstream/123456789/17858/3/... e lido na íntegra (98 páginas). CONFIRMADO por número de recomendação: Recomendação 34 (histerectomia benigna pode excluir), 35 (histerectomia por lesão/câncer continua rastreio), 36 (sem atividade sexual não rastreia); e por citação direta: rastreamento é definido como processo para população ASSINTOMÁTICA — mulher com sintoma de câncer avançado está FORA do escopo deste documento, deve ir a serviço especializado independente da periodicidade de rastreio (confirma o pontoCritico já registrado na Fase 2). Imunossuprimidas/PVHIV: DNA-HPV desde o início da atividade sexual, sem o piso de 25 anos. NÃO confirmados nesta sessão: fluxo de citologia reflexa por resultado de DNA-HPV não-16/18, conduta exata quando o teste DNA-HPV não está disponível na rede, e cronograma de implantação/transição. Distinção pedida entre (A) norma clínica vigente, (B) implementação gradual no SUS e (C) alternativa temporária de transição não foi feita nesta sessão — pendência explícita.",
    temasRelacionados: ["R020", "R106"],
    pontosCriticos: [
      "MUDANÇA DE PARADIGMA (MS/INCA/CONITEC, Portaria SAES/SECTICS nº 13/2025, 18/08/2025): rastreamento primário passa a ser por TESTE MOLECULAR DNA-HPV oncogênico, não mais citologia isolada — maior sensibilidade, intervalos mais longos",
      "Início do rastreamento: 25 anos (mulheres com história de atividade sexual), independente da orientação sexual",
      "Encerramento: 64 anos (com rastreamento adequado prévio); mulheres sem história de atividade sexual não necessitam rastreamento",
      "Periodicidade (DNA-HPV, 2025): teste negativo → repetir em 5 anos (rastreamento organizado, 25-64 anos) — NÃO usar mais o intervalo trienal de citologia isolada como regra geral para novos rastreios",
      "DNA-HPV positivo para tipos 16/18 (maior risco oncogênico): encaminhamento direto à colposcopia",
      "O rastreamento (periodicidade de 5 anos, DNA-HPV) vale para RASTREIO DE ROTINA em mulher ASSINTOMÁTICA — NÃO se aplica a paciente sintomática (sangramento anormal, lesão cervical visível ao exame), que segue investigação diagnóstica direta, não a periodicidade de rastreio populacional",
      "[PENDENTE DE CONFIRMAÇÃO HUMANA] Fluxo abaixo (ASC-US/LSIL/HSIL por citologia) reflete o protocolo anterior (2ª edição INCA 2023) — usar com cautela até revisão confirmar se o fluxo por citologia isolada mudou no cenário de transição para DNA-HPV",
      "NILM × 2 anos consecutivos: repetir a cada 3 anos",
      "ASC-US: repetir citologia em 1 ano (OU teste HPV se disponível); se HPV 16/18 positivo → colposcopia imediata",
      "LSIL: repetir citologia em 6 meses OU colposcopia imediata",
      "ASC-H: colposcopia imediata",
      "HSIL: colposcopia imediata + biópsia dirigida; se NIC2/3 → tratamento (LEEP, conização)",
      "Imunossuprimidas / PVHIV (CONFIRMADO por leitura direta, 3ª edição 2025): teste de DNA-HPV a partir do INÍCIO DA ATIVIDADE SEXUAL, independente de idade — regra de idade geral (25 anos) não se aplica a esse grupo",
      "HISTERECTOMIA (NOVO — confirmado por leitura direta, Recomendações 34/35, 3ª edição 2025): histerectomia total por lesão BENIGNA, sem história de lesão cervical de alto grau, com exames anteriores normais → PODE excluir do rastreamento (recomendação condicional, evidência baixa). Histerectomia por lesão precursora ou câncer do colo → CONTINUAR rastreando por coleta vaginal por pelo menos 25 anos ou indefinidamente",
      "SEM HISTÓRIA DE ATIVIDADE SEXUAL (CONFIRMADO, Recomendação 36, força FORTE/evidência moderada): não devem ser submetidas a rastreamento",
      "Vacinação HPV (PNI 2024): meninas 9–14 anos — 2 doses (0 e 6 meses); meninos 11–14 anos — 2 doses; imunossuprimidos 9–26 anos — 3 doses (0, 1–2 e 6 meses)",
      "PROIBIDO: rastreamento antes dos 25 anos em imunocompetentes — não indicado mesmo com início precoce da atividade sexual ou múltiplos parceiros",
      "Gestante: rastreamento habitual; colposcopia e biópsia podem ser realizados; NIC não é indicação de parto cesáreo — não relido linha a linha na 3ª edição nesta sessão",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 6. PRÉ-NATAL ──────────────────────────────────────────────────────────
  {
    id: "prenatal",
    tema: "Pré-natal",
    palavrasChave: [
      "pré-natal", "prenatal", "gestante", "gravidez", "pre eclampsia",
      "pré-eclâmpsia", "eclâmpsia", "hellp", "sulfato de magnesio",
      "antenatal", "obstétric", "partograma",
    ],
    fonte: "Manual de Atenção ao Pré-natal de Baixo Risco — MS 2022 + Protocolos FEBRASGO 2023",
    ano: 2023,
    pontosCriticos: [
      "Mínimo de consultas: 6 (MS recomenda ≥8); 1ª consulta antes de 12 semanas",
      "Exames 1º trimestre: hemograma, tipagem + Rh, glicemia de jejum, VDRL, HIV, HBsAg, urina I, urocultura, TSH, toxoplasmose IgG/IgM, rubéola IgG",
      "USG morfológico 1º trimestre: 10–13+6 semanas (TN + osso nasal, rastreio aneuploidias)",
      "USG morfológico 2º trimestre: 20–24 semanas",
      "Rastreio pré-eclâmpsia (1º trimestre): aspirina 100–150 mg/dia (início <16 semanas) + cálcio 1–1,5 g/dia se alto risco",
      "Suplementação obrigatória: ácido fólico 400–4000 mcg/dia (idealmente pré-concepcional até 12 sem); ferro 40 mg/dia a partir de 20 sem",
      "DMG — diagnóstico (TTOG 75g, 24–28 sem, critério HAPO): GJ ≥92 | 1h ≥180 | 2h ≥153 mg/dL (basta 1 valor alterado)",
      "Pré-eclâmpsia: PA ≥140/90 após 20 sem + proteinúria ≥300 mg/24h (ou prot/creat ≥0,3) OU critérios de gravidade sem proteinúria",
      "PE com gravidade: PA ≥160/110, plaquetas <100k, creatinina >1,1, EAP, epigastralgia com enzimas elevadas, scotomas/cefaleia",
      "Eclâmpsia: convulsão em PE → sulfato de magnésio (dose ataque 4–6g IV em 15–20 min + manutenção 1–2 g/h) → parto após estabilização",
      "HELLP: hemólise + TGO/TGP elevadas + plaquetas <100k → parto se ≥34 sem ou instabilidade clínica",
      "Vacinação na gestação (PNI 2024): dTpa (20–36 sem de cada gestação), influenza (qualquer trimestre), hepatite B (se não imunizada)",
      "PROIBIDO na gestação: IECA, BRA, AINEs (3º trimestre), fluoroquinolonas, tetraciclinas, cloranfenicol, estreptomicina",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 7. SÍFILIS ────────────────────────────────────────────────────────────
  {
    id: "sifilis",
    tema: "Sífilis",
    palavrasChave: [
      "sífilis", "treponema", "vdrl", "fta-abs", "tpha",
      "cancro", "sifilis primaria", "sifilis secundaria", "sifilis terciaria",
      "sifilis congenita", "penicilina benzatina", "pgb", "roséola sifilítica",
    ],
    fonte: "PCDT para Atenção Integral às Pessoas com Infecções Sexualmente Transmissíveis — MS 2022",
    ano: 2022,
    titulo: "Protocolo Clínico e Diretrizes Terapêuticas para Atenção Integral às Pessoas com Infecções Sexualmente Transmissíveis (IST) — atualizado 04/07/2024",
    orgao: "Ministério da Saúde (Departamento de HIV/Aids, Tuberculose, Hepatites Virais e IST)",
    urlOficial: "https://www.gov.br/saude/pt-br/assuntos/pcdt/a/atencao-integral-as-pessoas-com-infeccoes-sexualmente-transmissiveis/view",
    versao: "Atualização 04/07/2024",
    anoPublicacao: 2024,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PRONTA_PARA_VALIDACAO_HUMANA", // Fase 2: texto oficial integral lido (112 pag.) — esquema de PGB por estagio confirmado estavel — ver DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md
    validadeOuProximaRevisao: "revisar em até 90 dias — confirmar se o esquema de penicilina benzatina por estágio mudou na atualização 2024",
    observacoes: "Auditoria 2026-07-24 localizou atualização do PCDT-IST em 04/07/2024 (2 anos mais nova que a versão 2022 aqui cadastrada), com revisão do algoritmo de decisão clínica para sífilis adquirida/gestante. Não foi confirmado linha a linha se o esquema de PGB por estágio mudou — pontosCriticos abaixo NÃO foram alterados até confirmação humana. Usado em produção em SA_2026_2_Q5 (R015) citando a versão 2022 desatualizada.",
    temasRelacionados: ["R015", "R016", "R049", "R065", "R105"],
    pontosCriticos: [
      "Sífilis Primária: cancro duro (úlcera indolor, bordas endurecidas, base limpa) + adenopatia satélite indolor; VDRL pode ser negativo ou baixo",
      "Sífilis Secundária: roséola sifilítica (máculas palmo-plantares), condiloma plano, placas mucosas, alopecia; VDRL fortemente positivo",
      "Sífilis Latente: recente (<1 ano) vs tardia (>1 ano ou indeterminada) — diferença no número de doses de PGB",
      "Sífilis Terciária: goma sifilítica, neurossífilis, sífilis cardiovascular (aortite, aneurisma aórtico) — anos após infecção",
      "Diagnóstico: teste treponêmico (FTA-Abs, TPHA, teste rápido) + não treponêmico (VDRL, RPR) para estadiamento e controle",
      "Tratamento — Primária/Secundária/Latente Recente: Penicilina G Benzatina 2,4 milhões UI IM DOSE ÚNICA",
      "Tratamento — Latente Tardia/Terciária: PGB 2,4 milhões UI IM SEMANAL × 3 semanas (total 7,2 milhões UI)",
      "Neurossífilis: Penicilina G Cristalina 18–24 milhões UI/dia IV por 10–14 dias",
      "Sífilis Congênita: Penicilina G Cristalina IV 100.000 UI/kg/dia por 10 dias (ou benzatina se assintomático e mãe tratada adequadamente)",
      "Alergia à penicilina em gestante: OBRIGATÓRIO dessensibilizar e tratar com penicilina — doxiciclina e azitromicina NÃO são aceitas em gestantes",
      "Reação de Jarisch-Herxheimer: febre e mal-estar nas primeiras 24h — NÃO é alergia, NÃO interromper tratamento",
      "Controle de cura: queda de 2 diluições do VDRL em 6 meses = resposta adequada; sem queda ou aumento = reinfecção/falha → retreatar",
      "PROIBIDO: azitromicina e doxiciclina em gestantes (não previnem sífilis congênita); ceftriaxona não é 1ª escolha para sífilis",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 8. VACINAÇÃO ──────────────────────────────────────────────────────────
  {
    id: "vacinacao",
    tema: "Vacinação",
    palavrasChave: [
      "vacina", "vacinação", "calendário vacinal", "imunização", "pni",
      "sus vacina", "coqueluche", "sarampo", "rotavírus", "meningococo",
      "pneumococo", "hepatite b", "influenza", "dtpa", "bcg", "febre amarela",
      "vop", "vip", "penta",
    ],
    fonte: "Calendário Nacional de Vacinação SUS — PNI/MS 2024",
    ano: 2024,
    titulo: "Instrução Normativa do Calendário Nacional de Vacinação — 2026",
    orgao: "Ministério da Saúde / Programa Nacional de Imunizações (PNI)",
    urlOficial: "https://www.gov.br/saude/pt-br/vacinacao/publicacoes/instrucao-normativa-que-instrui-o-calendario-nacional-de-vacinacao-2026.pdf",
    versao: "Instrução Normativa 2026",
    anoPublicacao: 2026,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // Fase 3: PDF oficial integral lido (58 pag.) — blocos meningococico E dTpa (gestante/puerpera/profissional de saude) confirmados por citacao direta; BCG/Penta/VIP-VOP/Pneumo/Rotavirus/Triplice Viral/HPV/Influenza/CRIE NAO relidos nesta sessao — fechamento PARCIAL, nao pronto para validacao integral
    validadeOuProximaRevisao: "revisar em até 90 dias — calendário PNI tem ciclo de revisão frequente, confirmar demais esquemas além da mudança já identificada",
    observacoes: "Auditoria 2026-07-24 confirmou mudança de esquema: reforço aos 12 meses passou a usar meningocócica ACWY (não mais só Men C conjugada), conforme Instrução Normativa 2026. pontoCritico abaixo já corrigido. Demais esquemas (BCG, Penta, VIP/VOP, Pneumo, Rotavírus, Tríplice Viral etc.) não foram comparados linha a linha ao documento 2026 — tratar como não confirmados até revisão.",
    temasRelacionados: ["R032", "R033", "R051", "R107"],
    pontosCriticos: [
      "BCG: ao nascer (idealmente primeiras 12h); 1 dose; prematuros <37 sem → aguardar peso ≥2 kg",
      "Hepatite B: ao nascer (primeiras 12h) + Penta aos 2, 4 e 6 meses (total 4 doses)",
      "Pentavalente (DTP + Hib + HepB): 2, 4 e 6 meses + reforço DTP aos 15 meses e 4 anos",
      "VIP (Poliomielite inativada): 2, 4 e 6 meses; VOP (oral bivalente) reforços: 15 meses e 4 anos",
      "Pneumo 10: 2 e 4 meses + reforço aos 12 meses",
      "Meningocócica ACWY: reforço aos 12 meses (correção pós-auditoria 2026-07-24, Instrução Normativa 2026 — substitui o reforço que antes era só Meningo C conjugada aos 12 meses; esquema primário de Meningo C aos 3 e 5 meses não confirmado como alterado)",
      "Rotavírus humano (VORH): 2 e 4 meses (máximo: 1ª dose até 3 m 15 dias; 2ª dose até 7 m 29 dias)",
      "Tríplice Viral (SCR — sarampo, caxumba, rubéola): 12 meses + reforço aos 15 meses",
      "Varicela (SCRV — tetraviral): 15 meses (substituiu 2ª dose SCR)",
      "Febre Amarela: 9 meses + reforço aos 4 anos; 1 dose é vitalícia após os 5 anos; CONTRAINDICADA em gestantes e imunossuprimidos graves",
      "HPV Quadrivalente (PNI 2024): meninas 9–14 anos e meninos 11–14 anos — 2 doses (0 e 6 meses); imunossuprimidos 9–26 anos — 3 doses",
      "Influenza: anualmente a partir de 6 meses para grupos prioritários; campanha nacional anual (antes do outono)",
      "dT (adulto): a cada 10 anos",
      "dTpa (CORRIGIDO — Fase 3, leitura direta, PDF oficial IN 2026): gestante a partir da 20ª semana de gestação (na agenda oportuna do pré-natal), 1 dose por gestação — texto lido não confirma limite superior de '36 semanas' citado na versão anterior; puérpera até 45 dias pós-parto (se não vacinada na gestação); também indicada a profissionais de saúde de qualquer área e a parteiras tradicionais/estagiários que atuam em maternidade/UTI-UCI neonatal",
      "PROIBIDO: vacinas de vírus vivo atenuado (SCR, FA, varicela, VOP) em imunossuprimidos graves e gestantes (exceto influenza inativada e dTpa)",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 9. HIV/AIDS ────────────────────────────────────────────────────────────
  {
    id: "hiv",
    tema: "HIV/AIDS",
    palavrasChave: [
      "hiv", "aids", "sida", "antirretroviral", "tarv", "cd4",
      "carga viral", "prep", "pep", "pneumocistis", "toxoplasmose cerebral",
      "criptococose", "pvhiv", "dolutegravir",
    ],
    fonte: "PCDT para Manejo da Infecção pelo HIV em Adultos — MS 2022 + Nota Técnica DIAHV 2023",
    ano: 2023,
    titulo: "Protocolo Clínico e Diretrizes Terapêuticas para Manejo da Infecção pelo HIV em Adultos — Módulo I: Tratamento (2024)",
    orgao: "Ministério da Saúde / Departamento de HIV, Aids, Tuberculose, Hepatites Virais e IST (DIAHV)",
    urlOficial: "https://www.gov.br/aids/pt-br/central-de-conteudo/pcdts/pcdt_hiv_modulo_1_2024.pdf",
    versao: "Módulo I: Tratamento, edição 2024 (protocolo reorganizado em 3 módulos: I-Tratamento, II-Coinfecções, III-Comorbidades)",
    anoPublicacao: 2024,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // status geral da entrada (conservador) — ver statusModulos abaixo para granularidade real por bloco
    // Fase 3: cada bloco de HIV vem de um PCDT distinto e foi lido separadamente —
    // "PRONTA_PARA_VALIDACAO_HUMANA" aqui só alcança o bloco efetivamente lido,
    // nunca o restante da diretriz (regra explícita da Fase 3, Parte 5).
    statusModulos: {
      diagnostico: "PENDENTE_AJUSTE", // não relido nesta sessão
      tarv_1a_linha: "PRONTA_PARA_VALIDACAO_HUMANA", // PCDT Módulo I 2024 lido na íntegra (118 pág.) — esquema TDF+3TC+DTG confirmado estável
      gestacao: "PENDENTE_AJUSTE", // não relido nesta sessão (conteúdo cadastrado vem do Módulo I original, não confirmado)
      coinfeccoes: "PENDENTE_AJUSTE", // Módulo II não obtido/lido nesta sessão
      pep: "PRONTA_PARA_VALIDACAO_HUMANA", // PCDT PEP próprio (Portaria SECTICS/MS nº 14/2024) lido na íntegra (49 pág., 78 pág. no PDF) — 72h/28 dias/TDF+3TC+DTG confirmados estáveis, documento distinto do PCDT de tratamento
      prep: "PENDENTE_AJUSTE", // PCDT PrEP próprio (edição 2025) lido na íntegra (78 pág.) — NOVIDADE confirmada (modalidade sob demanda), mas lista de populações-alvo e demais critérios não comparados linha a linha — ajuste necessário antes de promover
      acompanhamento: "PENDENTE_AJUSTE", // não relido nesta sessão
      falha_terapeutica: "PENDENTE_AJUSTE", // não relido nesta sessão
    },
    validadeOuProximaRevisao: "TARV 1ª linha e PEP podem ser validados (documentos próprios lidos na íntegra); diagnóstico, gestação, coinfecções, PrEP (revisar lista de populações), acompanhamento e falha terapêutica ainda precisam de leitura dirigida",
    observacoes: "Fase 2 confirmou reorganização do PCDT de tratamento em 3 módulos (2024). Fase 3 (2026-07-24) confirma que PEP e PrEP são DOCUMENTOS PRÓPRIOS E DISTINTOS do PCDT de tratamento — não devem ser fundamentados automaticamente por ele (regra explícita da Fase 3): PCDT PEP (Portaria SECTICS/MS nº 14/2024, https://www.gov.br/saude/pt-br/assuntos/pcdt/p/profilaxia-pos-exposicao-de-risco-pep-a-infeccao-pelo-hiv, lido na íntegra) e PCDT PrEP Oral (edição 2025, https://www.gov.br/aids/pt-br/central-de-conteudo/pcdts/protocolo-clinico-e-diretrizes-terapeuticas-para-profilaxia-pre-exposicao-prep-oral-a-infeccao-pelo-hiv.pdf, lido na íntegra). TARV 1ª linha e PEP confirmados estáveis por citação direta. PrEP tem novidade confirmada (modalidade sob demanda, além da diária). Diagnóstico, gestação, coinfecções (Módulo II), acompanhamento e falha terapêutica NÃO foram lidos nesta sessão — ver `statusModulos` para granularidade exata por bloco.",
    temasRelacionados: ["R041", "R042", "R108"],
    pontosCriticos: [
      "Diagnóstico: 2 testes treponêmicos reagentes (ELISA 4ª geração OU teste rápido) + confirmação laboratorial; janela imunológica ~3–4 semanas",
      "TARV: iniciar em TODOS os pacientes, independente de CD4 ou carga viral (desde 2013 no Brasil — 'Tratar a Todos')",
      "Esquema 1ª linha (MS 2022): TDF + 3TC + DTG (Tenofovir 300mg + Lamivudina 300mg + Dolutegravir 50mg) — 1 comprimido/dia",
      "Profilaxia primária PCP: SMX-TMP 800/160mg 3×/semana se CD4 <200 células/mm³ ou <14%",
      "Profilaxia toxoplasmose cerebral: SMX-TMP 800/160mg/dia se CD4 <100 + sorologia IgG positiva",
      "Meningite criptocócica: anfotericina B desoxicolato 0,7–1 mg/kg/dia IV × 14 dias + fluconazol 400mg/dia → consolidação + manutenção",
      "MÓDULO PEP (CONFIRMADO por leitura direta, Fase 3 — PCDT PEP, Portaria SECTICS/MS nº 14/2024, documento próprio e distinto do PCDT de tratamento): iniciar em até 72h após a exposição de risco; esquema TDF/3TC 300/300mg + dolutegravir 50mg 1x/dia; duração 28 dias. Critério de indicação (Fonte: DATHI/SVSA/MS): tempo <72h + pessoa exposta não reagente para HIV no momento do atendimento. Conteúdo idêntico ao já cadastrado — confirmado estável",
      "MÓDULO PrEP (CONFIRMADO por leitura direta, Fase 3 — PCDT PrEP Oral, edição 2025, documento próprio e distinto do PCDT de tratamento e do PCDT de PEP): TDF/FTC — NOVIDADE CONFIRMADA: a partir da edição 2025 existem DUAS modalidades, PrEP oral DIÁRIA (1cp/dia) e PrEP oral SOB DEMANDA (esquema por evento, não diário) — a versão anterior cadastrada só mencionava a diária. Indicada para populações de alto risco (HSH, trans, trabalhadoras do sexo, casais sorodiscordantes) — não confirmado nesta sessão se a lista de populações-alvo mudou",
      "TB + HIV: iniciar TARV 2–8 semanas após início do RIPE (exceto TB meníngea: aguardar 8 semanas); rifampicina = forte indutor CYP3A4",
      "Transmissão vertical: TARV em toda gestante HIV+; AZT IV intraparto; AZT VO ao RN por 4–6 semanas; não amamentar",
      "Meta de supressão: carga viral indetectável (<50 cópias/mL) após 6 meses de TARV = U=U (indetectável = intransmissível)",
      "PROIBIDO: atrasar TARV por CD4 alto ou carga viral baixa; usar regimes com stavudina (d4T) — retirado do SUS por toxicidade",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 10. TUBERCULOSE ────────────────────────────────────────────────────────
  {
    id: "tuberculose",
    tema: "Tuberculose",
    palavrasChave: [
      "tuberculose", "tb", "bk", "bacilo de koch", "escarro",
      "ppd", "rifampicina", "isoniazida", "ripe", "tbmr",
      "latente", "mantoux", "tuberculose multidroga",
    ],
    fonte: "Manual de Recomendações para o Controle da Tuberculose no Brasil — MS 2019 (revisão 2022)",
    ano: 2022,
    pontosCriticos: [
      "Diagnóstico: clínica (tosse ≥3 semanas + febre vespertina + sudorese noturna + emagrecimento) + baciloscopia seriada × 2 + RX tórax",
      "Baciloscopia (BAAR): sensibilidade ~60–70% — positivo confirma TB pulmonar ativa; negativo não exclui",
      "Cultura + teste de sensibilidade: obrigatório em retratamento, HIV+, contato de TBMR, falência terapêutica",
      "Esquema Básico (SUS — DFC 4 em 1): 2RHZE / 4RH — 2 meses de Rifampicina + Isoniazida + Pirazinamida + Etambutol + 4 meses de Rifampicina + Isoniazida",
      "Efeitos adversos relevantes: Rifampicina = cor alaranjada das secreções (não é toxicidade) + hepatotoxicidade | Isoniazida = neuropatia periférica (prevenção: piridoxina 50 mg/dia) | Pirazinamida = hiperuricemia + hepatotoxicidade | Etambutol = neurite óptica (monitorar acuidade visual)",
      "TB + HIV: iniciar TARV 2–8 semanas após RIPE (exceto TB meníngea: aguardar 8 semanas); ajustar ARVs (rifampicina reduz nível de ARVs)",
      "Infecção Latente por TB (ILTB): tratar contatos recentes e HIV+ com tuberculina ≥5mm → Isoniazida 300mg/dia × 6 meses (6H) OU Rifampicina × 4 meses (4R)",
      "TB Meningoencefálica: adicionar dexametasona 0,4 mg/kg/dia por 4 semanas; esquema RHZE por 2 meses + RH por 10 meses (12 meses total)",
      "Tuberculose Multidroga-Resistente (TBMR): resistência a R+H → esquema individualizado com fluoroquinolonas + drogas de 2ª linha; notificação compulsória imediata",
      "PPD (Mantoux): ≥5mm em HIV+ ou imunossuprimidos | ≥10mm em população geral ou contatos | ≥15mm em sem fatores de risco",
      "Gestante: esquema RHZE é seguro durante toda a gestação; estreptomicina é contraindicada (ototoxicidade fetal)",
      "PROIBIDO: monoterapia em qualquer fase (risco de resistência); doses inadequadas; não notificar caso confirmado",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 11. DENGUE ─────────────────────────────────────────────────────────────
  // Hotfix pós-Lote 001: entrada controlada mínima criada para permitir geração
  // de questões sobre dengue sem bloqueio por REGRA SA-4 (o modelo tentava citar
  // "MS/SUS" sem fonte injetada — corretamente barrado, mas o tema ficava sem
  // grounding possível). Preferida a uma allowlist ampla, por instrução direta.
  {
    id: "dengue",
    tema: "Dengue",
    palavrasChave: ["dengue"],
    fonte: "Ministério da Saúde — Dengue: Diagnóstico e Manejo Clínico (5ª edição) + Notas Técnicas de atualização em cenário de epidemia",
    ano: 2023,
    pontosCriticos: [
      "Classificação por grupos: A (sem sinais de alarme, sem comorbidade/condição especial) | B (sem sinais de alarme, mas com sangramento espontâneo de pele, prova do laço positiva, condição clínica especial ou risco social) | C (com sinais de alarme) | D (sinais de choque/gravidade)",
      "Sinais de alarme: dor abdominal intensa e contínua, vômitos persistentes, acúmulo de líquidos (ascite, derrame pleural/pericárdico), sangramento de mucosa, letargia ou irritabilidade, hepatomegalia >2cm, aumento progressivo do hematócrito com queda rápida de plaquetas",
      "Sinais de choque/gravidade: extravasamento grave de plasma com choque, sangramento grave, comprometimento grave de órgãos (hepatite grave, encefalite, miocardite)",
      "Prova do laço: obrigatória em todo paciente com suspeita de dengue sem sinais de alarme, auxilia a triagem para o Grupo B",
      "Grupo A: hidratação oral vigorosa, acompanhamento ambulatorial, orientação de sinais de alarme e retorno imediato se surgirem",
      "Grupo B: hemograma obrigatório, observação em unidade de saúde até o resultado; hidratação oral até confirmação",
      "Grupo C: internação (leito de observação/enfermaria), reposição volêmica IV imediata com reavaliação clínica e de hematócrito seriada",
      "Grupo D: internação em leito de terapia intensiva, reposição volêmica rápida em bólus com reavaliação contínua",
      "PROIBIDO: uso de AAS (ácido acetilsalicílico) e anti-inflamatórios não esteroidais (AINEs) — risco de sangramento",
      "Notificação compulsória imediata de todo caso suspeito",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 12. ÉTICA MÉDICA ───────────────────────────────────────────────────────
  // Hotfix pós-Lote 001: idem — entrada mínima para sigilo médico/quebra
  // justificada, ancorada exclusivamente no Código de Ética Médica vigente
  // (fonte estável, sem edição recente que mude o conteúdo abaixo).
  {
    id: "etica_medica",
    tema: "Ética Médica — Sigilo Profissional",
    palavrasChave: [
      "ética médica", "sigilo médico", "sigilo profissional",
      "quebra de sigilo", "código de ética médica", "conselho federal de medicina",
    ],
    fonte: "Código de Ética Médica — Resolução CFM nº 2.217/2018 (alterada pelas Resoluções CFM nº 2.222/2018 e 2.226/2019)",
    ano: 2019,
    pontosCriticos: [
      "Art. 73: é vedado ao médico revelar fato de que tenha conhecimento em razão do exercício profissional, salvo justa causa, dever legal ou autorização expressa do paciente",
      "Justa causa para quebra do sigilo: risco de morte ou dano grave a terceiros, dever legal de notificação (doenças de notificação compulsória; maus-tratos contra crianças, adolescentes, idosos ou pessoas com deficiência; ferimentos por arma de fogo ou arma branca)",
      "Consentimento expresso e informado do próprio paciente autoriza a revelação, dentro do que foi consentido",
      "O sigilo médico persiste mesmo após a morte do paciente",
      "Sigilo em adolescentes: garantido, exceto quando há risco grave à vida/saúde do próprio paciente ou de terceiros, ou quando o adolescente não tem capacidade de avaliar o próprio risco — situação em que se pode/deve envolver o responsável legal",
      "Notificação compulsória de doença ou de situação de violência não constitui quebra de sigilo — é dever legal do médico",
      "PROIBIDO: revelar informação sigilosa por conveniência, a pedido de terceiros sem justa causa, ou sem consentimento do paciente fora das exceções previstas",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── FASE 2 — Macro Sprint de Governança Clínica: diretrizes novas propostas ──
  // Todas nascem com status PENDENTE_REVISAO — nunca são selecionadas por
  // detectarDiretrizDinamica/detectarDiretriz até validação humana explícita
  // (ver DOSSIER_VALIDACAO_DIRETRIZES_2026_2.md). Cobrem exatamente os 5
  // recortes (R017/R023+R111/R029/R036/R096) que a auditoria identificou como
  // exigindo grounding sem fonte cadastrada.

  // ── 13. ICTERÍCIA NEONATAL (proposta — cobre R017) ──────────────────────────
  {
    id: "ictericia_neonatal",
    tema: "Icterícia Neonatal",
    palavrasChave: [
      "icterícia neonatal", "icterícia do recém-nascido", "hiperbilirrubinemia neonatal",
      "nomograma de bhutani", "fototerapia neonatal", "exsanguineotransfusão",
    ],
    fonte: "Manual de Orientação nº 20 — Hiperbilirrubinemia Indireta no Período Neonatal, Departamento Científico de Neonatologia da Sociedade Brasileira de Pediatria (SBP)",
    ano: 2023,
    titulo: "Hiperbilirrubinemia Indireta no Período Neonatal — Manual de Orientação nº 20 (SBP)",
    orgao: "Sociedade Brasileira de Pediatria (SBP) — Departamento Científico de Neonatologia",
    urlOficial: "https://portal.afya.com.br/pediatria/hiperbilirrubinemia-indireta-no-periodo-neonatal-atualizacao-2021-da-sbp-parte-1",
    versao: "Manual nº 20, 29/09/2023",
    anoPublicacao: 2023,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // busca verificada, PDF do manual completo nao lido nesta sessao
    validadeOuProximaRevisao: "ler o manual completo (nao só resumos) antes de promover",
    observacoes: "Diretriz nova, proposta na Fase 2 para cobrir R017. Escopo estritamente NEONATAL — não usar para icterícia em lactente maior, criança ou colestase de outra etiologia.",
    temasRelacionados: ["R017"],
    pontosCriticos: [
      "Hiperbilirrubinemia 'significativa' (indicação usual de fototerapia): BT geral ≥12 mg/dL, mas a decisão real depende do NOMOGRAMA DE BHUTANI (idade gestacional + idade pós-natal em horas + nível de bilirrubina) — nunca um corte único isolado sem esses 3 eixos",
      "Hiperbilirrubinemia 'severa': BT próxima do nível de exsanguineotransfusão, geralmente ≥20 mg/dL, ou qualquer valor de BT associado a sinais de encefalopatia bilirrubínica aguda (EBA)",
      "Hiperbilirrubinemia 'extrema': BT no nível de exsanguineotransfusão, geralmente ≥25 mg/dL, ou qualquer valor com sinais de EBA",
      "Reavaliação pós-alta deve ser agendada conforme a ZONA DE RISCO do nomograma de Bhutani no momento da alta, não por um prazo fixo genérico igual para todos os RN",
      "Icterícia precoce (<24h de vida) nunca deve ser classificada como fisiológica sem investigar hemólise (armadilha clássica do tema)",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 14. DIVERTICULITE AGUDA / CLASSIFICAÇÃO DE HINCHEY (proposta — cobre R023/R111) ──
  {
    id: "diverticulite",
    tema: "Diverticulite Aguda — Classificação de Hinchey",
    palavrasChave: [
      "diverticulite", "classificação de hinchey", "diverticulose complicada",
    ],
    fonte: "Classificação de Hinchey + recomendações WSES (World Society of Emergency Surgery) 2020 sobre diverticulite aguda (via fontes secundárias — documento WSES primário não lido)",
    ano: 2020,
    titulo: "Classificação de Hinchey para diverticulite aguda + WSES 2020 (referência internacional)",
    orgao: "World Society of Emergency Surgery (WSES) — sociedade internacional; sem PCDT/MS brasileiro específico identificado",
    urlOficial: null,
    versao: "WSES 2020 (não confirmado se há edição mais recente)",
    anoPublicacao: 2020,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // CONFIANCA REDUZIDA: apenas fontes secundarias (blogs educacionais), documento WSES primario nao localizado/lido
    validadeOuProximaRevisao: "localizar e ler o documento WSES primário antes de promover; confirmar se antibiótico de rotina em quadro leve ainda é recomendado (ver nota de conflito com R111 abaixo)",
    observacoes: "CONFIANÇA REDUZIDA — via fontes secundárias/educacionais, não o documento WSES primário completo. Fase 3 (2026-07-24): localizado o artigo primário real — 'WSES 2020 update of the guidelines for the management of acute colonic diverticulitis in the emergency setting', World Journal of Emergency Surgery (link.springer.com/article/10.1186/s13017-020-00313-4 / PMC7206757) — mas o texto completo NÃO foi baixado/lido nesta sessão, só resumo de busca. Confirmado por esse resumo: a atualização 2020 cobre tanto diverticulite ESQUERDA (ALCD) quanto DIREITA (ARCD, mais prevalente em algumas regiões — nota nova, não presente na versão anterior desta entrada); e que para peritonite difusa por perfuração, sigmoidectomia laparoscópica de urgência só é sugerida 'se houver habilidade técnica e equipamento disponíveis' (recomendação FRACA, não forte) — isso é mais granular que o ponto crítico genérico já cadastrado ('lavagem/drenagem NÃO são 1ª linha'), mas ainda não substitui leitura integral. Risco de conflito interno PERMANECE ABERTO: R111 (Mapa Mestre) já registra que diverticulite aguda NÃO COMPLICADA pode ser tratada SEM antibiótico rotineiro — isso pode contradizer o ponto crítico de posologia abaixo, que veio de fonte secundária mais antiga/genérica. NÃO promover sem baixar e ler o artigo WSES 2020 completo e resolver essa divergência.",
    temasRelacionados: ["R023", "R111"],
    pontosCriticos: [
      "Classificação de Hinchey: I = abscesso pericólico | II = abscesso pélvico/retroperitoneal | III = peritonite purulenta | IV = peritonite fecal",
      "Diverticulite não complicada (sem sinais de sepse, boa tolerância oral, sem comorbidade significativa/imunossupressão/peritonite/febre alta/leucocitose importante) pode ser tratada ambulatorialmente",
      "WSES 2020: lavagem e drenagem laparoscópica NÃO são tratamento de 1ª linha em peritonite por diverticulite colônica aguda (Hinchey III/IV)",
      "[NÃO USAR SEM CONFIRMAÇÃO — CONFLITO INTERNO NÃO RESOLVIDO] posologia de antibiótico oral em quadro leve — fonte secundária cita esquema de 7-10 dias, mas R111 do Mapa Mestre já indica que antibiótico rotineiro pode não ser necessário em diverticulite não complicada; não incluir dose/duração de antibiótico em questão até essa divergência ser resolvida por leitura do documento primário",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 15. TVP / ESCORE DE WELLS (proposta — cobre R029) ───────────────────────
  {
    id: "tvp_wells",
    tema: "Trombose Venosa Profunda — Escore de Wells",
    palavrasChave: [
      "escore de wells", "trombose venosa profunda", "probabilidade pré-teste tvp",
    ],
    fonte: "Escore de Wells (validação original) + uso corrente endossado por diretrizes de referência (ex.: CHEST/ACCP) — documento primário CHEST/ACCP não lido",
    ano: 2021,
    titulo: "Escore de Wells para TVP — validação original + uso corrente (CHEST/ACCP)",
    orgao: "Escore validado internacionalmente; sem PCDT/MS brasileiro específico identificado",
    urlOficial: null,
    versao: "não confirmada — documento primário não localizado nesta sessão",
    anoPublicacao: null,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // via fontes educacionais secundarias, documento CHEST/ACCP primario nao lido
    validadeOuProximaRevisao: "localizar e ler a diretriz CHEST/ACCP primária antes de promover; confirmar limitações em gestante/oncológico/internado",
    observacoes: "Diretriz nova, proposta na Fase 2 para cobrir R029 (já gerado como SA_2026_2_Q6 sem grounding formal — esta entrada, se validada, cobriria tentativas futuras do mesmo tema).",
    temasRelacionados: ["R029"],
    pontosCriticos: [
      "Wells ≤0 = baixa probabilidade pré-teste (~3% prevalência de TVP) | 1-2 = moderada (~17%) | ≥3 = alta (50-75%)",
      "Probabilidade baixa ou moderada → solicitar D-dímero; se negativo, exclui TVP com segurança",
      "Probabilidade alta → ultrassonografia com Doppler venoso DIRETAMENTE, sem necessidade de D-dímero prévio (armadilha central do recorte: pedir D-dímero em alta probabilidade atrasa o exame definitivo)",
      "[LIMITAÇÃO EXPLÍCITA] o escore de Wells é ferramenta de PROBABILIDADE PRÉ-TESTE, nunca diagnóstico isolado — sempre exige teste complementar; validação reduzida em gestantes, pacientes internados e pacientes oncológicos ativos, populações em que o escore isolado não deve ser a base da decisão",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 16. DISTOCIA DE OMBRO (proposta — cobre R036) ───────────────────────────
  {
    id: "distocia_ombro",
    tema: "Distocia de Ombro",
    palavrasChave: [
      "distocia de ombro", "manobra de mcroberts", "manobra de rubin", "manobra de gaskin",
    ],
    fonte: "Guia de Habilidades — Distócia de Ombro, FEBRASGO",
    ano: 2023,
    titulo: "Guia de Habilidades — Distócia de Ombro (FEBRASGO)",
    orgao: "Federação Brasileira das Associações de Ginecologia e Obstetrícia (FEBRASGO)",
    urlOficial: "https://www.febrasgo.org.br/images/GUIA_DE_HABILIDADES_DISTOCIA_DE_OMBRO.pdf",
    versao: "Emissão 25/03/2023",
    anoPublicacao: 2023,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // titulo/data/orgao confirmados por busca; download do PDF falhou nesta sessao (falha tecnica), texto integral nao lido
    validadeOuProximaRevisao: "baixar e ler o PDF completo (falha técnica de download nesta sessão); confirmar contraindicação de pressão fúndica no texto oficial",
    observacoes: "Diretriz nova, proposta na Fase 2 para cobrir R036.",
    temasRelacionados: ["R036"],
    pontosCriticos: [
      "Sequência recomendada: 1) manobra de McRoberts (hiperextensão de coxas/agachamento) → 2) pressão suprapúbica (manobra de Rubin I, 30s contínua + 30s pulsada se sem sucesso) → 3) posição de quatro apoios (manobra de Gaskin) → 4) manobras internas/rotação do ombro posterior",
      "Distocia de ombro ocorre em até 3% dos partos vaginais, INCLUSIVE sem nenhum fator de risco identificável previamente — fator de risco não deve ser tratado como preditor absoluto",
      "[A CONFIRMAR NO TEXTO OFICIAL — não afirmar como fato já verificado] pressão fúndica (manobra de Kristeller) é classicamente contraindicada em distocia de ombro por poder agravar o encravamento do ombro — mencionada em conhecimento geral, não confirmada linha a linha no Guia FEBRASGO 2023 nesta sessão",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },

  // ── 17. VIOLÊNCIA DOMÉSTICA E NOTIFICAÇÃO (proposta — cobre R096) ───────────
  {
    id: "violencia_domestica",
    tema: "Violência Doméstica — Notificação Compulsória",
    palavrasChave: [
      "violência doméstica", "notificação compulsória", "violência contra a mulher",
      "lei maria da penha",
    ],
    fonte: "Lei nº 13.931/2019 (notificação compulsória de violência contra a mulher) + Portaria de Consolidação MS nº 4/2017 (Lista Nacional de Notificação Compulsória) — textos legais não lidos na íntegra, apenas ementas/resumos verificados",
    ano: 2019,
    titulo: "Lei nº 13.931/2019 — Notificação compulsória de violência contra a mulher (+ normas correlatas de notificação compulsória em saúde)",
    orgao: "Congresso Nacional / Ministério da Saúde",
    urlOficial: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13931.htm",
    versao: "Lei 13.931/2019 (altera Lei 10.778/2003), vigente desde 10/03/2020",
    anoPublicacao: 2019,
    dataUltimaRevisao: "2026-07-24",
    revisadoPor: null,
    status: "PENDENTE_REVISAO",
    statusDocumental: "PENDENTE_AJUSTE", // Fase 3: prazo/destinatario (autoridade policial, 24h) confirmados por citacao literal do artigo de lei (via busca, WebFetch direto ao planalto.gov.br falhou por reset de conexao) — bloco "mulher adulta" avancado; blocos crianca/adolescente (ECA), pessoa idosa, pessoa com deficiencia, violencia sexual e risco iminente NAO cobertos nesta sessao
    validadeOuProximaRevisao: "ler o texto integral do artigo (não só o trecho citado); cobrir separadamente os blocos criança/adolescente (ECA/Lei 13.431/2017), pessoa idosa (Estatuto do Idoso), pessoa com deficiência e violência sexual — esta entrada cobre hoje SOMENTE mulher adulta",
    observacoes: "Diretriz nova, proposta na Fase 2 para cobrir R096 — causa raiz confirmada das 3 falhas de geração na Fase 1. Fase 3 (2026-07-24) CONFIRMOU por citação literal do Art. 1º §1º da Lei 10.778/2003 (alterado pela Lei 13.931/2019): comunicação obrigatória à AUTORIDADE POLICIAL (não Ministério Público, corrige hipótese da Fase 2) em até 24 horas, 'para as providências cabíveis e para fins estatísticos'. Citação obtida via trecho reproduzido em busca — tentativa de leitura direta da página completa (WebFetch) falhou por reset de conexão do servidor; portanto NÃO é leitura integral artigo-por-artigo do texto legal, apenas citação literal de alta confiança. Esta entrada cobre SOMENTE o bloco 'mulher adulta' (conforme escopo original do recorte R096) — os blocos criança/adolescente, pessoa idosa, pessoa com deficiência, violência sexual e risco iminente exigidos pela Fase 3 NÃO foram desenvolvidos nesta sessão por restrição de tempo; permanecem como lacuna explícita. Cruza com `etica_medica` (art. 73 CEM) para o ponto de sigilo x dever legal.",
    temasRelacionados: ["R096"],
    pontosCriticos: [
      "Violência contra a mulher (suspeita ou confirmada) atendida em serviço de saúde = NOTIFICAÇÃO COMPULSÓRIA obrigatória, independente da vontade da vítima de prosseguir com queixa formal (Lei 13.931/2019)",
      "NOTIFICAÇÃO COMPULSÓRIA EM SAÚDE ≠ DENÚNCIA POLICIAL/BOLETIM DE OCORRÊNCIA — são atos distintos; a notificação do serviço de saúde não substitui nem depende do registro de BO pela vítima (armadilha central do recorte: tratar os dois como sinônimos)",
      "Notificação compulsória é dever legal do médico e NÃO constitui quebra de sigilo (mesmo princípio do art. 73 do Código de Ética Médica, diretriz `etica_medica`)",
      "Lei Maria da Penha (11.340/2006) é o marco de MEDIDAS PROTETIVAS (afastamento do agressor etc.), acionado por pedido da vítima ou decisão judicial — não é, em si, o mecanismo de notificação compulsória em saúde; não confundir os dois marcos legais",
      "PRAZO CONFIRMADO (Fase 3): Lei 13.931/2019, que altera a Lei 10.778/2003, Art. 1º §1º — casos com indícios ou confirmação de violência contra a mulher devem ser 'obrigatoriamente comunicados à autoridade policial no prazo de 24 (vinte e quatro) horas, para as providências cabíveis e para fins estatísticos'. IMPORTANTE: destinatário confirmado é a AUTORIDADE POLICIAL (não Ministério Público, correção em relação à hipótese da Fase 2) — mas o texto qualifica essa comunicação como 'para fins estatísticos', reforçando que não é a mesma coisa que a vítima registrar uma denúncia/BO por iniciativa própria",
      "[LIMITAÇÃO DE MÉTODO] o parágrafo acima foi obtido por trecho citado em resultado de busca reproduzindo o texto legal, não por leitura direta da página completa do planalto.gov.br — uma tentativa de acesso direto (WebFetch) falhou por reset de conexão. Tratar como confiança alta (é citação literal do artigo de lei, não paráfrase), mas não como 'documento lido na íntegra artigo por artigo'",
    ],
    ativa: true,
    historica: false,
    substitui: null,
  },
];

// ─── CORRESPONDÊNCIA DE PALAVRA-CHAVE ────────────────────────────────────────
// Hotfix (auditoria pós-Lote 001): algumas palavras-chave curtas colidiam como
// substring dentro de palavras não relacionadas — "nic" dentro de "clínica"/
// "crônica"/"técnica", "gina" dentro de "vagina"/"vaginal", "tb"/"bk" (2 letras,
// risco estrutural). Para essas — e só essas —, a correspondência passa a exigir
// fronteira de palavra (\b): "clínica" não tem "nic" como token isolado (é
// seguida de "a" sem separador), mas "NIC" ou "(NIC)" continuam casando.
// Todas as demais palavras-chave (frases mais longas, sem esse risco) mantêm o
// comportamento substring original — nenhuma regressão nas 12 entradas atuais.
const _PALAVRAS_FRONTEIRA_OBRIGATORIA = new Set(["nic", "gina", "tb", "bk"]);
const _escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _casaPalavraChave = (texto, kw) => {
  const kwLower = kw.toLowerCase();
  if (_PALAVRAS_FRONTEIRA_OBRIGATORIA.has(kwLower)) {
    return new RegExp(`\\b${_escapeRegex(kwLower)}\\b`, "i").test(texto);
  }
  return texto.includes(kwLower);
};

// ─── GOVERNANÇA CLÍNICA — STATUS DE VIGÊNCIA (Macro Sprint 2026.2, corrigido
// na Micro Sprint 4A.1 — Achado Crítico C1) ───────────────────────────────
// Fail-closed: só libera grounding quando `status` é EXPLICITAMENTE
// VIGENTE_CONFIRMADA. Ausência de campo, string vazia ou qualquer valor
// desconhecido bloqueiam. Isto vale tanto para a lista estática quanto para
// documentos vindos do Firestore (mesma função, mesma regra) — corrige o
// Achado C1: `semearBase()` (PainelDiretrizes.jsx) nunca gravou o campo
// `status`, e o comportamento antigo (`status === undefined` liberava)
// tratava esses documentos como vigentes por omissão. Como consequência
// deste fix, as diretrizes ainda não auditadas nesta fase (sepse, asma,
// tuberculose, dengue, etica_medica, prenatal — sem `status` no arquivo)
// também passam a ser bloqueadas até receberem status explícito.
export const STATUS_DIRETRIZ = {
  VIGENTE_CONFIRMADA: "VIGENTE_CONFIRMADA",
  PENDENTE_REVISAO: "PENDENTE_REVISAO",
  DESATUALIZADA: "DESATUALIZADA",
  SUBSTITUIDA: "SUBSTITUIDA",
  BLOQUEADA: "BLOQUEADA",
};
const _statusUtilizavel = (d) => d.status === STATUS_DIRETRIZ.VIGENTE_CONFIRMADA;

// Encontra todos os candidatos por palavra-chave, ignorando status — usado
// tanto pela seleção normal (que depois filtra por status) quanto pela
// checagem de bloqueio (que precisa saber se HÁ diretriz relevante mesmo
// quando ela não está vigente, para poder barrar a geração com motivo claro
// em vez de simplesmente prosseguir sem grounding nenhum).
const _candidatasPorPalavraChave = (lista, temaMestre, subtema) => {
  const texto = `${temaMestre} ${subtema}`.toLowerCase();
  return lista.filter(
    d => d.ativa && Array.isArray(d.palavrasChave) && d.palavrasChave.some(kw => _casaPalavraChave(texto, kw))
  );
};

// ─── DETECTAR NA LISTA DINÂMICA (Firestore) ──────────────────────────────────
// Recebe a lista carregada do Firestore (ou estática como fallback).
// Preferir diretriz ativa E com status utilizável; a versão mais recente
// (maior ano) tem prioridade entre as utilizáveis.
// ÚNICA lógica de seleção do arquivo — detectarDiretriz (abaixo) delega para
// esta função em vez de reimplementar o desempate, para as duas nunca
// divergirem (hotfix: resumoEngine.js usava só detectarDiretriz, que decidia
// por "primeiro match na ordem do array" — diferente do critério "maior ano"
// usado por RoboGerador/ImportadorPro/ResumoGerador via detectarDiretrizDinamica,
// podendo escolher fontes controladas diferentes para o mesmo tema+subtema).
export const detectarDiretrizDinamica = (lista = [], temaMestre = "", subtema = "") => {
  const candidatas = _candidatasPorPalavraChave(lista, temaMestre, subtema).filter(_statusUtilizavel);
  if (!candidatas.length) return null;
  return candidatas.reduce((best, cur) => (cur.ano > best.ano ? cur : best));
};

// ─── DETECTAR NA LISTA ESTÁTICA (fallback) ───────────────────────────────────
// Delega para detectarDiretrizDinamica com a lista estática — mesma assinatura
// e mesmo retorno de sempre (uma diretriz ou null), mas agora com o MESMO
// critério de desempate (maior ano) usado em todos os outros caminhos.
export const detectarDiretriz = (temaMestre = "", subtema = "") =>
  detectarDiretrizDinamica(DIRETRIZES_CONTROLADAS, temaMestre, subtema);

// ─── AVALIAR BLOQUEIO POR GOVERNANÇA (Macro Sprint 2026.2) ───────────────────
// Chamada ANTES de montar o prompt/chamar a IA. Diferente de
// detectarDiretrizDinamica (que silenciosamente ignora diretrizes não
// vigentes e cai para "sem grounding"), esta função existe para DETECTAR que
// havia uma diretriz relevante para o tema, mas ela não está em condições de
// uso — permitindo barrar a geração com motivo explícito em vez de prosseguir
// sem nenhum grounding para um tema que claramente precisa dele.
export const avaliarBloqueioDiretriz = (lista = [], temaMestre = "", subtema = "") => {
  const candidatas = _candidatasPorPalavraChave(lista, temaMestre, subtema);
  if (!candidatas.length) return { bloqueado: false, diretriz: null, motivo: null };

  const melhorUtilizavel = candidatas.filter(_statusUtilizavel);
  const melhorGeral = candidatas.reduce((best, cur) => (cur.ano > best.ano ? cur : best));

  if (melhorUtilizavel.length > 0) return { bloqueado: false, diretriz: melhorGeral, motivo: null };

  const motivoPorStatus = {
    [STATUS_DIRETRIZ.PENDENTE_REVISAO]: "diretriz pendente de revisão humana (edição mais nova localizada, conteúdo não confirmado linha a linha)",
    [STATUS_DIRETRIZ.DESATUALIZADA]: "diretriz confirmada como desatualizada",
    [STATUS_DIRETRIZ.SUBSTITUIDA]: "diretriz substituída por edição mais nova",
    [STATUS_DIRETRIZ.BLOQUEADA]: "diretriz bloqueada manualmente",
  };
  const motivo = motivoPorStatus[melhorGeral.status] || `diretriz com status não utilizável (${melhorGeral.status})`;
  return { bloqueado: true, diretriz: melhorGeral, motivo };
};

// ─── MONTAR BLOCO DE INJEÇÃO PARA O PROMPT ───────────────────────────────────
// Retorna string formatada a ser inserida no prompt antes do FOCO PEDAGÓGICO.
export const montarBlocoDiretriz = (diretriz) =>
  `\n━━━ DIRETRIZ CONTROLADA — INJEÇÃO OBRIGATÓRIA ━━━\n` +
  `TEMA SENSÍVEL DETECTADO: ${diretriz.tema}\n` +
  `FONTE OFICIAL VIGENTE: ${diretriz.fonte}\n` +
  `ANO DE REFERÊNCIA: ${diretriz.ano}\n\n` +
  `PONTOS CRÍTICOS OBRIGATÓRIOS (use exatamente estes critérios na questão):\n` +
  diretriz.pontosCriticos.map(p => `• ${p}`).join("\n") +
  `\n\nREGRAS ESTRITAS PARA ESTA QUESTÃO:\n` +
  `✗ PROIBIDO usar classificação, critério diagnóstico ou conduta anterior a ${diretriz.ano}\n` +
  `✗ PROIBIDO misturar critérios de diretrizes diferentes (ex: SBC 2016 + SBC 2024)\n` +
  `✗ PROIBIDO usar conduta obsoleta sem aviso explícito de "protocolo antigo — revisar"\n` +
  `✓ OBRIGATÓRIO preencher: "fonte_diretriz": "${diretriz.fonte}"\n` +
  `✓ OBRIGATÓRIO preencher: "ano_diretriz": ${diretriz.ano}\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
