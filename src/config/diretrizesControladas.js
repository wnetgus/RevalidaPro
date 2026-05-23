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
    pontosCriticos: [
      "Meta pressórica geral: PA < 130/80 mmHg para a maioria dos adultos com HAS",
      "Meta em idosos frágeis > 80 anos: PAS 130–150 mmHg (individualizar)",
      "Classificação 2024 — Normal: <120/80 | Elevada: 120-129/<80 | HAS Est.1: 130-139/80-89 | HAS Est.2: ≥140/90",
      "HAS Estágio 1 sem lesão de órgão-alvo: iniciar monoterapia (IECA, BRA, BCC ou tiazídico)",
      "HAS Estágio 2 (≥160/100) ou alto risco CV: iniciar com combinação de 2 medicamentos",
      "1ª linha: IECA (enalapril, captopril) OU BRA OU BCC (anlodipino) OU tiazídico (clortalidona/HCTZ)",
      "Emergência hipertensiva: PA elevada + LOA aguda (encefalopatia, AVC, EAP, IAM, dissecção) → UTI + droga IV + redução PAM ≤25% na 1ª hora",
      "Agentes IV de escolha: nitroprussiato (geral), nicardipina (AVC), labetalol (dissecção/gestante), hidralazina (gestante)",
      "Urgência hipertensiva: PA muito elevada SEM LOA → redução gradual em 24–48h com VO (captopril, clonidina)",
      "PROIBIDO: nifedipino sublingual (queda abrupta = AVC/IAM isquêmico)",
      "Gestante: metildopa, hidralazina, labetalol. IECA/BRA são absolutamente contraindicados na gestação",
      "Síndrome metabólica e DM: alvo < 130/80 mmHg; preferir IECA ou BRA (nefroproteção)",
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
    pontosCriticos: [
      "Diagnóstico: GJ ≥126 mg/dL (×2) | TTOG 2h ≥200 mg/dL | HbA1c ≥6,5% | Glicemia aleatória ≥200 + sintomas",
      "Pré-diabetes: GJ 100–125 mg/dL | TTOG 2h 140–199 mg/dL | HbA1c 5,7–6,4%",
      "Meta HbA1c geral: <7,0%; idosos frágeis ou múltiplas comorbidades: <8,0%; gestantes: <6,0%",
      "DM2 — 1ª linha: Metformina 500–2000 mg/dia (se TFG ≥30 e sem contraindicações)",
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
      "GINA 2024 PROÍBE SABA em monoterapia como único tratamento — risco aumentado de morte por asma",
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
      "colo uterino", "colo do útero", "papanicolau", "colpocitologia",
      "hpv", "cervical", "nio", "nic", "rastreamento cervical",
      "colposcopia", "asc-us", "lsil", "hsil", "asc-h",
    ],
    fonte: "INCA 2023 — Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero (2ª edição)",
    ano: 2023,
    pontosCriticos: [
      "Início do rastreamento: 25 anos (mulheres com história de atividade sexual), independente da orientação sexual",
      "Encerramento: 64 anos (com 2 citologias negativas nos últimos 5 anos); mulheres sem história de atividade sexual não necessitam rastreamento",
      "Periodicidade INCA 2023: citologia (Papanicolau) anual × 2 anos consecutivos negativos → a cada 3 anos",
      "NILM × 2 anos consecutivos: repetir a cada 3 anos",
      "ASC-US: repetir citologia em 1 ano (OU teste HPV se disponível); se HPV 16/18 positivo → colposcopia imediata",
      "LSIL: repetir citologia em 6 meses OU colposcopia imediata",
      "ASC-H: colposcopia imediata",
      "HSIL: colposcopia imediata + biópsia dirigida; se NIC2/3 → tratamento (LEEP, conização)",
      "Imunossuprimidas / PVHIV: iniciar rastreamento após início da atividade sexual (qualquer idade); realizar anualmente",
      "Vacinação HPV (PNI 2024): meninas 9–14 anos — 2 doses (0 e 6 meses); meninos 11–14 anos — 2 doses; imunossuprimidos 9–26 anos — 3 doses (0, 1–2 e 6 meses)",
      "PROIBIDO: rastreamento antes dos 25 anos em imunocompetentes — não indicado mesmo com início precoce da atividade sexual ou múltiplos parceiros",
      "Gestante: rastreamento habitual; colposcopia e biópsia podem ser realizados; NIC não é indicação de parto cesáreo",
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
    pontosCriticos: [
      "BCG: ao nascer (idealmente primeiras 12h); 1 dose; prematuros <37 sem → aguardar peso ≥2 kg",
      "Hepatite B: ao nascer (primeiras 12h) + Penta aos 2, 4 e 6 meses (total 4 doses)",
      "Pentavalente (DTP + Hib + HepB): 2, 4 e 6 meses + reforço DTP aos 15 meses e 4 anos",
      "VIP (Poliomielite inativada): 2, 4 e 6 meses; VOP (oral bivalente) reforços: 15 meses e 4 anos",
      "Pneumo 10: 2 e 4 meses + reforço aos 12 meses",
      "Meningo C conjugada: 3 e 5 meses + reforço aos 12 meses",
      "Rotavírus humano (VORH): 2 e 4 meses (máximo: 1ª dose até 3 m 15 dias; 2ª dose até 7 m 29 dias)",
      "Tríplice Viral (SCR — sarampo, caxumba, rubéola): 12 meses + reforço aos 15 meses",
      "Varicela (SCRV — tetraviral): 15 meses (substituiu 2ª dose SCR)",
      "Febre Amarela: 9 meses + reforço aos 4 anos; 1 dose é vitalícia após os 5 anos; CONTRAINDICADA em gestantes e imunossuprimidos graves",
      "HPV Quadrivalente (PNI 2024): meninas 9–14 anos e meninos 11–14 anos — 2 doses (0 e 6 meses); imunossuprimidos 9–26 anos — 3 doses",
      "Influenza: anualmente a partir de 6 meses para grupos prioritários; campanha nacional anual (antes do outono)",
      "dT (adulto): a cada 10 anos; dTpa: 1 dose na gestante entre 20–36 semanas de cada gestação",
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
    pontosCriticos: [
      "Diagnóstico: 2 testes treponêmicos reagentes (ELISA 4ª geração OU teste rápido) + confirmação laboratorial; janela imunológica ~3–4 semanas",
      "TARV: iniciar em TODOS os pacientes, independente de CD4 ou carga viral (desde 2013 no Brasil — 'Tratar a Todos')",
      "Esquema 1ª linha (MS 2022): TDF + 3TC + DTG (Tenofovir 300mg + Lamivudina 300mg + Dolutegravir 50mg) — 1 comprimido/dia",
      "Profilaxia primária PCP: SMX-TMP 800/160mg 3×/semana se CD4 <200 células/mm³ ou <14%",
      "Profilaxia toxoplasmose cerebral: SMX-TMP 800/160mg/dia se CD4 <100 + sorologia IgG positiva",
      "Meningite criptocócica: anfotericina B desoxicolato 0,7–1 mg/kg/dia IV × 14 dias + fluconazol 400mg/dia → consolidação + manutenção",
      "PEP (Profilaxia Pós-Exposição): iniciar em até 72h (ideal < 2h), durar 28 dias — TDF+3TC+DTG; notificar e acompanhar",
      "PrEP (Profilaxia Pré-Exposição): TDF+FTC 1 cp/dia — indicada para populações de alto risco (HSH, trans, trabalhadoras do sexo, casais sorodiscordantes)",
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
];

// ─── DETECTAR NA LISTA ESTÁTICA (fallback) ───────────────────────────────────
export const detectarDiretriz = (temaMestre = "", subtema = "") => {
  const texto = `${temaMestre} ${subtema}`.toLowerCase();
  return (
    DIRETRIZES_CONTROLADAS.find(
      d => d.ativa && d.palavrasChave.some(kw => texto.includes(kw.toLowerCase()))
    ) || null
  );
};

// ─── DETECTAR NA LISTA DINÂMICA (Firestore) ──────────────────────────────────
// Recebe a lista carregada do Firestore (ou estática como fallback).
// Preferir diretriz ativa; a versão mais recente (maior ano) tem prioridade.
export const detectarDiretrizDinamica = (lista = [], temaMestre = "", subtema = "") => {
  const texto = `${temaMestre} ${subtema}`.toLowerCase();
  const candidatas = lista.filter(
    d => d.ativa && Array.isArray(d.palavrasChave) && d.palavrasChave.some(kw => texto.includes(kw.toLowerCase()))
  );
  if (!candidatas.length) return null;
  return candidatas.reduce((best, cur) => (cur.ano > best.ano ? cur : best));
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
