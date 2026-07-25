# DOSSIÊ DE VALIDAÇÃO — DIRETRIZES CLÍNICAS SUPER APOSTAS 2026.2

**Fase 2 da Macro Sprint de Governança Clínica.** Data: 2026-07-24. Referências: `AUDITORIA_ATUALIZACAO_CLINICA_NORMATIVA_2026_2.md` (2d5eca0), `MACRO_SPRINT_GOVERNANCA_CLINICA_2026_2.md` (Fase 1).

**Método:** para `dm`, `sifilis`, `hiv`, `vacinacao`, o texto integral do documento oficial foi baixado e extraído (PDF→texto real, não resumo de busca) — citações abaixo vêm de leitura direta. Para `has`, `rastreamento_colo` e as 5 diretrizes novas, a base é busca web verificada (título/órgão/data confirmados) mas **sem** leitura do PDF completo — confiança marcada explicitamente em cada dossiê. Nenhuma diretriz foi promovida a `VIGENTE_CONFIRMADA` nesta fase — todos os campos de validação humana permanecem vazios, conforme instruído.

---

## PARTE 2 — DOSSIÊS DAS 6 DIRETRIZES EXISTENTES

### 1. `has` — Hipertensão Arterial Sistêmica

**Identificação:** Diretriz Brasileira de Hipertensão Arterial — 2025 (atualização da 7ª Diretriz). SBC/SBH/SBN. Arq Bras Cardiol. 2025;122(9):e20250624, DOI 10.36660/abc.20250624. Publicação 2025. URL: https://abccardiol.org/en/article/brazilian-guidelines-of-hypertension-2025/. Substitui: 7ª Diretriz 2024 (mesma linhagem, atualização). Vigência: ativa. Contexto: sociedade médica brasileira (SBC/SBH/SBN), inclui capítulo específico sobre manejo no SUS.

**Confiança:** busca verificada, PDF completo **não lido nesta sessão**.

**Escopo real:** adultos com HAS ou risco de desenvolvê-la; inclui capítulo dedicado ao SUS (~75% dos hipertensos brasileiros). Population especiais mencionadas: idosos, gestantes (tratadas na diretriz de pré-natal, não aqui), DM/síndrome metabólica.

**Mudanças em relação à versão cadastrada:** classificação como "mudança apenas documental/de edição" — busca não encontrou contradição de conteúdo, só edição mais nova (2025 vs. 2024 cadastrado). Meta 130/80, MAPA/MRPA e estratificação de risco aparecem consistentes nos resumos encontrados. **Conteúdo que não foi possível confirmar:** se as classes de 1ª linha por comorbidade, os agentes IV de emergência hipertensiva e os limiares de PA por estágio mudaram entre 2024 e 2025 — não verificado linha a linha.

**Conteúdo controlado (atômico) — mantido do cadastro Fase 1, sem alteração de conteúdo:**
- U-HAS-01: Meta pressórica geral <130/80 mmHg | adultos com HAS, exceto idosos frágeis >80a (130-150 individualizar) | fonte: SBC/SBH/SBN 2024-2025 | risco de desatualização: baixo-médio (não confirmado se mudou em 2025) | uso: questões de meta terapêutica.
- U-HAS-02: Emergência hipertensiva = PA elevada + LOA aguda → UTI + droga IV + reduzir PAM ≤25% na 1ª hora | fonte idem | risco: baixo-médio | uso: questões de conduta em crise hipertensiva.
- U-HAS-03: Nifedipino sublingual proibido na crise hipertensiva (risco de queda abrupta) | fonte idem | risco: baixo (conduta amplamente estável na literatura) | uso: questões de armadilha/erro clássico.

**Conteúdo proibido/inseguro:** não simplificar "meta <130/80" para todos sem exceção de idosos frágeis; não citar classe de 1ª linha específica por comorbidade sem confirmação humana da edição 2025.

---

### 2. `dm` — Diabetes Mellitus

**Identificação:** Diretriz da Sociedade Brasileira de Diabetes — Edição 2025, capítulo "Manejo da terapia antidiabética no DM2". SBD. URL: https://diretriz.diabetes.org.br/manejo-da-terapia-antidiabetica-no-dm2-2/. Substitui: diretriz SBD anterior (2024, "escala móvel"/metformina universal). Vigência: ativa, publicação contínua por capítulo em 2025.

**Confiança:** **texto integral lido** (HTML completo da página oficial, ~119 mil caracteres extraídos e verificados por grep).

**Escopo real:** adultos com DM2. Recomendações R8 e adjacentes fazem cortes por: risco cardiovascular (baixo/intermediário/alto), presença de sobrepeso/obesidade (IMC), HbA1c (acima/abaixo de 7,5%), doença cardiorrenal estabelecida. Não cobre DM1 nem DM gestacional (tratada à parte, na diretriz `prenatal`).

**Mudança confirmada de conduta (citação exata do documento oficial, lida integralmente):**
> "adultos com DM2 e risco cardiovascular baixo ou intermediário, sem tratamento prévio, sem evidência de doença cardiorrenal, obesidade ou sobrepeso, e com HbA1c <7,5% (ou <0,5% acima do alvo), a METFORMINA É RECOMENDADA em monoterapia, como primeira escolha [...] Classe I Nível B"

Fora desse perfil exato (doença cardiorrenal estabelecida, obesidade/sobrepeso, HbA1c mais alto, risco CV alto), a diretriz orienta escolha individualizada — iSGLT2/GLP-1 podem entrar antes ou junto da metformina conforme o perfil, não depois dela por padrão. **Confirma e corrige o registro da Fase 1** (que já havia captado essa condicionalidade por busca; agora confirmado por leitura do documento primário).

**Conteúdo controlado (atômico) — atualizado com citação de página/seção:**
- U-DM-01: metformina monoterapia = 1ª escolha SOMENTE se: risco CV baixo/intermediário + sem tto prévio + sem doença cardiorrenal + sem obesidade/sobrepeso + HbA1c <7,5% | Classe I, Nível B | fonte: SBD Ed.2025, capítulo "Manejo da terapia antidiabética no DM2", seção sobre monoterapia inicial | risco de desatualização: baixo (lido na íntegra) | uso: questões de escolha de 1ª linha.
- U-DM-02: iSGLT2 mantém eficácia glicêmica e segurança CV mesmo em subgrupos com doença cardiovascular estabelecida (uso em monoterapia avaliado) | mesma fonte | risco: baixo | uso: questões de indicação de iSGLT2 fora do perfil-padrão de metformina.
- U-DM-03: benefício cardiovascular dos GLP-1 RA independe do grau de perda de peso e se estende a pacientes com e sem doença CV estabelecida | mesma fonte | risco: baixo | uso: questões sobre mecanismo/indicação de GLP-1.

**Conteúdo proibido/inseguro:** não afirmar "metformina nunca mais é 1ª linha" (simplificação indevida na direção oposta) nem "metformina sempre é 1ª linha" (a versão antiga, já corrigida). A condição completa (5 critérios) deve aparecer junto, nunca isolada.

---

### 3. `rastreamento_colo` — Rastreamento do Câncer do Colo do Útero

**Identificação:** Diretrizes Brasileiras para o Rastreamento do Câncer do Colo do Útero — Volume 1: Rastreamento organizado com teste molecular para detecção de DNA-HPV oncogênico. MS/INCA/CONITEC. Portaria SAES/SECTICS nº 13/2025, publicada 18/08/2025 no Diário Oficial da União. URL: https://www.gov.br/conitec/pt-br/midias/protocolos/diretrizes/diretriz-brasileira-rastreamento-do-cancer-do-colo-do-utero-diretriz-brasileira. Substitui: 2ª edição INCA 2023 (citologia).

**Confiança:** busca verificada (múltiplas fontes gov.br/INCA/CONITEC/Cofen convergentes); PDF completo não lido nesta sessão (bloqueio de acesso 403 em uma tentativa).

**Escopo real:** população-alvo 25-64 anos, mulheres com histórico de atividade sexual. **Rastreamento de rotina** (assintomáticas) — não se aplica a paciente sintomática (sangramento anormal, lesão visível), que segue investigação diagnóstica direta, não o fluxo de rastreio.

**Mudança de método confirmada:** rastreamento primário passa de citologia (Papanicolau) para teste molecular DNA-HPV oncogênico; DNA-HPV positivo para tipos 16/18 → colposcopia direta.

**Mudança de intervalo confirmada:** teste negativo → repetir em 5 anos (substitui o intervalo trienal por citologia).

**Conteúdo que não foi possível confirmar:** conduta exata quando DNA-HPV não está disponível na rede (fallback para citologia?); cronograma de implantação/transição entre os dois métodos; conduta detalhada para imunossuprimidas/PVHIV sob o novo modelo (a versão antiga previa rastreio anual nessa população, sob citologia — não confirmado se isso muda com DNA-HPV).

**Conteúdo controlado (atômico):**
- U-COLO-01: rastreamento primário = teste DNA-HPV oncogênico, não citologia isolada | população 25-64 anos, histórico de atividade sexual | fonte: Portaria SAES/SECTICS 13/2025 | risco de desatualização: médio (fluxo detalhado não lido na íntegra) | uso: questão sobre método primário vigente.
- U-COLO-02: teste negativo → repetir em 5 anos | mesma fonte | risco: médio | uso: questão de periodicidade.
- U-COLO-03: DNA-HPV 16/18 positivo → colposcopia direta | mesma fonte | risco: médio | uso: questão de conduta pós-teste positivo.
- **[BLOQUEADO PARA GERAÇÃO]** fluxo de ASC-US/LSIL/HSIL por citologia (fluxo antigo, papel no novo modelo não confirmado) — não usar até confirmação humana.

**Conteúdo proibido/inseguro:** não aplicar o fluxo de rastreio (5 anos, DNA-HPV) a uma paciente SINTOMÁTICA no enunciado — isso é investigação diagnóstica, regida por outra lógica clínica, não pela periodicidade de rastreio populacional.

---

### 4. `vacinacao` — Calendário Nacional de Vacinação

**Identificação:** Instrução Normativa do Calendário Nacional de Vacinação — 2026. MS/PNI. URL: https://www.gov.br/saude/pt-br/vacinacao/publicacoes/instrucao-normativa-que-instrui-o-calendario-nacional-de-vacinacao-2026.pdf.

**Confiança:** **texto integral lido** (PDF oficial, 58 páginas, ~153 mil caracteres extraídos).

**Escopo real:** documento cobre calendário da criança, adolescente, adulto, idoso e gestante **separadamente** — não é uma regra genérica única (conforme exigido). Esta Fase 2 extraiu em detalhe o bloco de meningocócicas (crianças); os demais blocos (BCG/Penta/VIP-VOP/Pneumo/Rotavírus/Tríplice Viral/Febre Amarela/HPV/Influenza/dT-dTpa) foram mantidos do cadastro Fase 1 (search-verificado, não relidos linha a linha nesta sessão pontual sobre meningocócicas).

**Mudança de esquema confirmada (citação exata do PDF oficial, seção "10. Vacina adsorvida meningocócica C" e "14. Vacina meningocócica ACWY"):**
> "Esquema básico: 2 doses, aos 3 meses e aos 5 meses de idade [com vacina Men C]. Dose de reforço: 1 dose aos 12 meses com uso da vacina men ACWY (conjugada)."
> "Adolescente entre 11 e 14 anos, 11 meses e 29 dias de idade" também recebe men ACWY (dose específica, não detalhada nesta extração).

Ou seja: o **esquema básico infantil continua sendo Men C aos 3 e 5 meses** — só o **reforço aos 12 meses** passa a ser feito com **men ACWY**, não mais Men C. Isso refina (e confirma como correto) o registro já feito na Fase 1.

**Conteúdo controlado (atômico) — por população, não misturado:**
- U-VAC-CRI-01 (criança): esquema básico Men C aos 3 e 5 meses (2 doses) + reforço aos 12 meses com Men ACWY | fonte: IN Calendário 2026, seção 10/14 | risco: baixo (lido na íntegra) | uso: questão de calendário infantil.
- U-VAC-ADO-01 (adolescente): Men ACWY indicada entre 11 e 14 anos, 11m29d | mesma fonte | risco: baixo-médio (dose/intervalo exato não extraído nesta sessão, só a indicação etária) | uso: questão de calendário do adolescente — **não usar para número de doses até confirmar**.
- U-VAC-BLOQUEIO-01: vacinação de bloqueio (surto meningocócico) só mediante confirmação laboratorial de sorogrupo + decisão conjunta das 3 esferas de governo; Men C/ACWY não indicadas rotineiramente em gestantes, mas podem ser usadas mediante avaliação risco-benefício | mesma fonte | risco: baixo | uso: questão de vacinação de bloqueio/gestante.

**Conteúdo proibido/inseguro:** não misturar o esquema de criança com o de adolescente/adulto/gestante/idoso na mesma afirmação — cada população tem regra própria, confirmado pelo próprio documento (a instrução normativa realmente os separa por seção). Não afirmar dose/intervalo do bloco adolescente além do que foi extraído (indicação etária apenas).

---

### 5. `sifilis` — Sífilis / PCDT-IST

**Identificação:** Protocolo Clínico e Diretrizes Terapêuticas para Atenção Integral às Pessoas com Infecções Sexualmente Transmissíveis (IST) — atualizado 04/07/2024 (última alteração registrada 22/01/2025). MS/DCCI/SVS. URL: https://www.gov.br/saude/pt-br/assuntos/pcdt/a/atencao-integral-as-pessoas-com-infeccoes-sexualmente-transmissiveis/view. Substitui: PCDT 2022.

**Confiança:** **texto integral lido** (PDF oficial, 112 páginas, ~390 mil caracteres extraídos).

**Escopo real:** adultos e gestantes com sífilis adquirida ou na gestação; inclui seção específica para PVHIV; sífilis congênita é abordada em conjunto (RN).

**Mudança confirmada:** **NENHUMA mudança de dose/esquema encontrada** — o esquema terapêutico do documento 2024 é **idêntico** ao já cadastrado desde 2022. Classificação: "conteúdo que permaneceu estável" (não é uma mudança apenas documental, é uma confirmação positiva de estabilidade lendo o texto real).

**Conteúdo controlado (atômico) — confirmado por leitura direta, com página/seção real:**
- U-SIF-01: sífilis recente (primária/secundária/latente recente ≤1 ano): benzilpenicilina benzatina 2,4 milhões UI IM dose única (1,2 milhão em cada glúteo) | fonte: PCDT-IST 2024, seção 5.6, Quadro (p.~22) | risco: baixo (lido na íntegra) | uso: questão de tratamento por estágio.
- U-SIF-02: latente tardia/duração ignorada/terciária: benzilpenicilina benzatina 2,4 milhões UI IM semanal × 3 semanas (total 7,2 milhões UI) | mesma fonte, mesma seção | risco: baixo | uso: idem.
- U-SIF-03: gestante com teste reagente (rápido ou laboratorial) = tratar imediatamente após 1 teste reagente, sem esperar confirmação — benzilpenicilina benzatina é a **única** opção seguirá seguro/eficaz na gestação; doxiciclina/ceftriaxona não substituem | fonte: seção 5.6/5.6.2 | risco: baixo | uso: questão de sífilis em gestante.
- U-SIF-04: tratamento adequado na gestação = iniciado ≥30 dias antes do parto + esquema completo para o estágio | fonte: seção sobre sífilis congênita (p.~24) | risco: baixo | uso: questão de definição de tratamento materno adequado (crucial para não confundir com sífilis congênita do RN).
- U-SIF-05: reação de Jarisch-Herxheimer (febre/mal-estar nas 1ª 24h) NÃO é alergia, não interrompe tratamento | fonte: seção 5.6.3 | risco: baixo | uso: questão de armadilha (confundir com alergia).
- U-SIF-06: intervalo entre doses do esquema de 3 semanas — não gestante: máx. 14 dias (senão reiniciar); gestante: máx. 7 dias (senão reiniciar) | fonte: seção 5.6, nota de rodapé c | risco: baixo | uso: questão de manejo de atraso de dose.
- U-SIF-07: parceria sexual exposta em até 90 dias — tratamento presuntivo com dose única de 2,4 milhões UI, independente de sintomas, mesmo antes do resultado do teste | fonte: seção sobre parcerias (p.~35) | risco: baixo | uso: questão de manejo de parceria sexual.
- U-SIF-08: risco de anafilaxia à penicilina benzatina = 0,002% (dado da Conitec, citado no PCDT) | fonte: p.~24 | risco: baixo | uso: questão sobre segurança/contraindicação.

**Conteúdo proibido/inseguro:** não afirmar que doxiciclina/ceftriaxona são alternativas equivalentes em gestante (proibido pela própria fonte); não confundir "tratamento adequado da mãe" (define se o RN é notificado como sífilis congênita) com o tratamento do RN em si.

---

### 6. `hiv` — HIV/AIDS

**Identificação:** Protocolo Clínico e Diretrizes Terapêuticas para Manejo da Infecção pelo HIV em Adultos — Módulo I: Tratamento (2024). MS/DATHI-SVSA (antigo DIAHV). URL: https://www.gov.br/aids/pt-br/central-de-conteudo/pcdts/pcdt_hiv_modulo_1_2024.pdf. Substitui: PCDT 2022 + Nota Técnica 2023 (mesma linhagem, reorganizado em 3 módulos: I-Tratamento, II-Coinfecções, III-Comorbidades).

**Confiança:** **texto integral lido** (PDF oficial, 118 páginas, ~218 mil caracteres extraídos).

**Escopo real:** adultos vivendo com HIV (PVHA). PEP/PrEP tratados no mesmo documento mas como seções distintas — não confundir com o tratamento crônico da infecção já estabelecida.

**Mudança confirmada:** **NENHUMA mudança no esquema de 1ª linha** — confirmado por leitura direta: "O esquema preferencial para início de tratamento é a associação de tenofovir com lamivudina e dolutegravir" (idêntico ao já cadastrado). "Tratar Todos" (TARV independente de CD4) também confirmado textualmente e mantido. Classificação: "conteúdo que permaneceu estável".

**Conteúdo controlado (atômico) — confirmado por leitura direta:**
- U-HIV-01: TARV para TODA PVHA, independente de CD4 ou carga viral | fonte: PCDT 2024, seção "Quando iniciar a Tarv" (p.~40) | risco: baixo (lido na íntegra) | uso: questão de início de tratamento.
- U-HIV-02: esquema preferencial inicial = tenofovir + lamivudina + dolutegravir, dose única diária | fonte: Quadro 5 (p.40) | risco: baixo | uso: questão de esquema inicial.
- U-HIV-03: tenofovir contraindicado se doença renal/TFGe <60 mL/min; nesses casos substituir (ver alternativas do Quadro 5) | mesma fonte | risco: baixo | uso: questão de contraindicação de TARV.
- U-HIV-04: genotipagem pré-tratamento indicada em gestantes HIV+, PVHIV-TB, crianças/adolescentes ao diagnóstico, e em soroconversão durante uso de PrEP | fonte: seção sobre genotipagem (Quadro 4) | risco: baixo | uso: questão de indicação de genotipagem.

**Conteúdo proibido/inseguro:** não misturar as regras de PEP/PrEP (profilaxia, pessoa NÃO infectada ou com exposição de risco) com o tratamento de quem já vive com HIV — são fluxos distintos no mesmo documento. Conteúdo de PEP/PrEP do cadastro Fase 1 não foi relido linha a linha nesta sessão (mantido como estava, mesmo nível de confiança da Fase 1).

---

## PARTE 4 — DOSSIÊS DAS 5 DIRETRIZES FALTANTES (propostas novas)

### 7. `ictericia_neonatal` — Icterícia Neonatal (proposta nova)

**Contexto do recorte confirmado primeiro, conforme exigido:** R017 é especificamente **neonatal** (recém-nascido, não pediátrico geral, não adulto, não obstrutiva de outra etiologia) — "Icterícia neonatal — diferenciação fisiológica vs. patológica e indicação de fototerapia".

**Identificação:** Manual de Orientação nº 20 — Hiperbilirrubinemia Indireta no Período Neonatal, Departamento Científico de Neonatologia da Sociedade Brasileira de Pediatria (SBP), 29/09/2023. Órgão: sociedade médica brasileira reconhecida (referência nacional para o tema, na ausência de PCDT/MS específico).

**Confiança:** busca verificada (Portal Afya + referência direta ao manual SBP nº 20); PDF completo não baixado nesta sessão.

**Escopo real:** recém-nascidos (não se aplica a lactentes maiores/crianças com icterícia colestática, fora do escopo desta diretriz).

**Conteúdo controlado (atômico):**
- U-ICT-01: hiperbilirrubinemia "significativa" (indicação usual de fototerapia) = BT geral ≥12 mg/dL, mas a decisão real depende do nomograma de Bhutani (idade gestacional + idade pós-natal em horas + nível de bilirrubina), não de um corte único isolado | fonte: SBP Manual nº 20, 2023 | risco de desatualização: médio (não lido na íntegra) | uso: questão de indicação de fototerapia.
- U-ICT-02: hiperbilirrubinemia "severa" ≈ BT≥20 mg/dL (perto do nível de exsanguineotransfusão) ou qualquer BT com sinais de encefalopatia bilirrubínica (EBA); "extrema" ≈ BT≥25 ou qualquer valor com sinais de EBA | mesma fonte | risco: médio | uso: questão de gravidade/indicação de exsanguineotransfusão.
- U-ICT-03: reavaliação pós-alta deve ser agendada conforme a zona de risco do nomograma de Bhutani no momento da alta, não por um prazo fixo genérico | mesma fonte | risco: médio | uso: questão de seguimento pós-alta.

**Conteúdo proibido/inseguro:** não usar um valor de corte único e fixo (ex.: "sempre >12 = fototerapia") sem mencionar a dependência de idade gestacional/pós-natal do nomograma — essa é exatamente a armadilha que o recorte original quer testar ("classificar icterícia precoce <24h como fisiológica sem investigar hemólise" também precisa entrar como armadilha companion). Não aplicar a colestase/icterícia obstrutiva (fora do escopo desta diretriz).

---

### 8. `diverticulite` — Diverticulite Aguda / Classificação de Hinchey (proposta nova)

**Identificação:** Classificação de Hinchey (original) + recomendações WSES (World Society of Emergency Surgery) 2020 sobre manejo da diverticulite aguda. Órgão: sociedade internacional de referência para o tema (não há PCDT/MS brasileiro específico identificado nesta busca).

**Confiança:** busca verificada via fontes educacionais/secundárias (Sanarmed, Afya, artigos de revisão); **documento WSES original não lido nesta sessão** — confiança mais baixa que as demais.

**Escopo real:** diverticulite aguda do cólon em adultos.

**Conteúdo controlado (atômico):**
- U-DIV-01: classificação de Hinchey: I = abscesso pericólico; II = abscesso pélvico/retroperitoneal; III = peritonite purulenta; IV = peritonite fecal | fonte: classificação clássica de Hinchey, referenciada por WSES | risco: médio (não lido documento primário) | uso: questão de estadiamento.
- U-DIV-02: diverticulite não complicada (sem sinais de sepse, boa tolerância oral, sem comorbidade significativa/imunossupressão/peritonite/febre alta/leucocitose importante) pode ser tratada ambulatorialmente | fonte: WSES (via secundária) | risco: médio-alto (fonte secundária, não primária) | uso: questão de decisão ambulatorial vs. internação.
- U-DIV-03: WSES 2020 — lavagem e drenagem laparoscópica NÃO são 1ª linha em peritonite por diverticulite colônica aguda | fonte: WSES 2020 (via secundária) | risco: médio-alto | uso: questão de conduta cirúrgica em Hinchey III/IV.

**Conteúdo proibido/inseguro:** **não usar dose/esquema de antibiótico específico** (ex.: "ciprofloxacino + metronidazol por 7-10 dias") como fato controlado nesta fase — essa informação veio só de fontes secundárias/blogs educacionais, não do documento WSES primário, e há evidência crescente (mencionada inclusive na própria busca) de que diverticulite leve pode não precisar de antibiótico de rotina (ver R111 do Mapa Mestre, que já registra exatamente essa atualização) — **risco de contradição interna se não tratado com cuidado**. Recomendo tratar esta diretriz inteira como **conteúdo de confiança reduzida** até leitura do documento WSES primário.

---

### 9. `tvp_wells` — TVP / Escore de Wells (proposta nova)

**Identificação:** Escore de Wells para TVP (Wells et al., validação original) + uso corrente endossado por diretrizes de sociedades de referência (ex.: CHEST/ACCP). Órgão: escore validado internacionalmente, sem PCDT/MS brasileiro específico identificado.

**Confiança:** busca verificada via fontes educacionais (Sanarmed, Whitebook, Medway); documento CHEST/ACCP primário **não lido nesta sessão**.

**Escopo real:** pacientes ambulatoriais com suspeita de TVP de membro inferior. **Limitações explícitas:** não validado da mesma forma em gestantes, pacientes internados ou pacientes oncológicos ativos — nessas populações o escore isolado não deve ser a base da decisão.

**Conteúdo controlado (atômico):**
- U-TVP-01: Wells ≤0 = baixa probabilidade (~3% prevalência); 1-2 = moderada (~17%); ≥3 = alta (50-75%) | fonte: validação original de Wells, uso corrente | risco: médio (não lido documento primário) | uso: questão de estratificação pré-teste.
- U-TVP-02: probabilidade baixa/moderada → D-dímero; se negativo, exclui TVP com segurança | mesma fonte | risco: médio | uso: questão de sequência diagnóstica.
- U-TVP-03: probabilidade alta → ultrassonografia com Doppler venoso diretamente, SEM necessidade de D-dímero prévio | mesma fonte | risco: médio | uso: questão de armadilha (pedir D-dímero em vez de imagem na alta probabilidade — exatamente a armadilha do recorte R029 original).
- U-TVP-04 **[LIMITAÇÃO EXPLÍCITA — não usar como diagnóstico isolado]**: o escore de Wells é uma ferramenta de PROBABILIDADE PRÉ-TESTE, nunca um diagnóstico por si só — sempre exige teste complementar (D-dímero ou imagem) para confirmação/exclusão | risco: baixo (limitação amplamente consensual) | uso: barreira contra questões que tratem "Wells alto = TVP confirmada".

**Conteúdo proibido/inseguro:** não apresentar o escore como diagnóstico definitivo; não aplicar automaticamente a gestantes/pacientes internados/oncológicos sem mencionar a limitação de validação nessas populações.

---

### 10. `distocia_ombro` — Distocia de Ombro (proposta nova)

**Identificação:** Guia de Habilidades — Distócia de Ombro, FEBRASGO, emissão 25/03/2023. Órgão: sociedade médica brasileira reconhecida (referência nacional em obstetrícia).

**Confiança:** busca verificada com título/data/órgão confirmados; PDF não extraído com sucesso nesta sessão (falha técnica de download).

**Escopo real:** distocia de ombro diagnosticada durante o parto vaginal (ocorre em até 3% dos partos vaginais, inclusive sem fatores de risco prévios — **não deve virar previsão absoluta baseada em fator de risco**, conforme exigido).

**Conteúdo controlado (atômico):**
- U-DIST-01: sequência recomendada — 1) McRoberts (hiperextensão de coxas/agachamento) → 2) pressão suprapúbica (manobra de Rubin I, 30s contínua + 30s pulsada se sem sucesso) → 3) quatro apoios (manobra de Gaskin) → 4) manobras internas/rotação | fonte: FEBRASGO, Guia de Habilidades, 25/03/2023 | risco: médio (fonte confirmada, texto integral não lido) | uso: questão de sequência de manobras.
- U-DIST-02: distocia de ombro ocorre em até 3% dos partos vaginais, inclusive SEM fatores de risco identificáveis previamente | mesma fonte | risco: médio | uso: barreira contra questão que trate fator de risco como preditor absoluto.

**Conteúdo proibido/inseguro:** **não recomendar pressão fúndica** (manobra de Kristeller/pressão no fundo uterino) — é classicamente contraindicada em distocia de ombro (pode piorar o encravamento do ombro), embora esta sessão não tenha confirmado essa contraindicação especificamente no texto FEBRASGO 2023 (registrar como ponto a confirmar, não como fato já verificado). Não transformar fator de risco (macrossomia, DM materno) em regra preditiva absoluta — a própria fonte confirma que ocorre mesmo sem eles.

---

### 11. `violencia_domestica` — Violência Doméstica e Notificação (proposta nova)

**Identificação:** três normas distintas, deliberadamente não misturadas:
1. Lei nº 13.931/2019 — notificação compulsória de violência contra a mulher, vigente desde 10/03/2020.
2. Portaria de Consolidação MS nº 4/2017 (Anexo, atualizada por Portaria nº 1.271/2014 mencionada nas buscas) — Lista Nacional de Notificação Compulsória de agravos.
3. Lei Maria da Penha (11.340/2006) — mecanismos de proteção à mulher em situação de violência doméstica, **não é a norma de notificação em si**, é o marco de proteção/medidas protetivas.

**Confiança:** busca verificada, múltiplas fontes jurídicas/institucionais convergentes; textos legais não lidos na íntegra nesta sessão (checagem de ementa/resumo, não do texto de lei completo artigo por artigo).

**Escopo real — camadas que NÃO podem ser tratadas como sinônimos (conforme exigido):**
- **Notificação compulsória em saúde** (Lei 13.931/2019): dever do serviço de saúde, mesmo sem consentimento da vítima, dirigida preferencialmente à autoridade policial especializada + Ministério Público — é um fluxo SANITÁRIO/administrativo obrigatório, não depende da vontade da vítima em processar.
- **Denúncia/Boletim de Ocorrência**: ato voluntário da vítima (ou de terceiro) na delegacia — **distinto** da notificação compulsória; a notificação compulsória do serviço de saúde NÃO substitui nem depende da vítima registrar BO.
- **Lei Maria da Penha**: marco de medidas protetivas (afastamento do agressor, etc.), acionado por pedido da vítima ou por decisão judicial — não é, em si, o mecanismo de notificação compulsória em saúde.
- **Sigilo médico**: mantido para o restante das informações do prontuário; a notificação compulsória é a exceção legal expressa (dever legal), não uma quebra "por conveniência".

Recorte-alvo específico (R096) é sobre reconhecimento de sinais + fluxo de notificação — não sobre o mecanismo judicial da Lei Maria da Penha em si.

**Conteúdo controlado (atômico):**
- U-VD-01: violência contra a mulher (suspeita ou confirmada) atendida em serviço de saúde = notificação compulsória obrigatória, independente da vontade da vítima de prosseguir com queixa formal | fonte: Lei 13.931/2019 | risco: médio (texto de lei não lido na íntegra) | uso: questão de dever de notificar.
- U-VD-02: notificação compulsória em saúde ≠ denúncia policial/BO — são atos distintos; um não substitui nem depende do outro | fonte: distinção consolidada nas normas acima | risco: baixo (distinção conceitual estável) | uso: barreira contra a armadilha central deste recorte (confundir os dois atos).
- U-VD-03: notificação compulsória é dever legal do médico e NÃO constitui quebra de sigilo (já confirmado também pela diretriz `etica_medica`, art. 73 CEM) | fonte: cruzamento com `etica_medica` | risco: baixo | uso: questão de sigilo x dever legal.
- U-VD-04 **[NÃO usar sem confirmação]**: prazo exato de notificação (ex. "em até 24h") mencionado em fontes secundárias mas não confirmado no texto legal primário nesta sessão — não incluir prazo numérico específico até confirmação humana.

**Conteúdo proibido/inseguro:** este é exatamente o ponto que causou as 3 falhas de geração de R096 na Fase 1 — não permitir que a IA cite prazo/norma numérica específica sem grounding aqui presente; não tratar Lei Maria da Penha, ECA (proteção de crianças/adolescentes) e a lei de notificação compulsória (mulher adulta) como a mesma norma — são três marcos legais distintos, cada um com seu próprio recorte potencial (criança/adolescente e pessoa idosa/com deficiência têm normas de notificação próprias, não cobertas por esta entrada, que é focada em violência contra a mulher adulta).

---

## PARTE 5 — FICHAS DE VALIDAÇÃO (11 diretrizes)

Todas as fichas abaixo têm os 4 campos de decisão humana **vazios**, conforme instruído — nenhuma diretriz foi promovida nesta fase.

| id | Status técnico | Fonte confirmada | Divergências | Risco | Pergunta para decisão humana | Status documental |
|---|---|---|---|---|---|---|
| `has` | PENDENTE_REVISAO | SBC/SBH/SBN 2025 (busca) | Edição mais nova, conteúdo não comparado linha a linha | Baixo-médio | As classes de 1ª linha por comorbidade e os agentes IV de emergência mudaram entre 2024→2025? | PENDENTE_AJUSTE |
| `dm` | PENDENTE_REVISAO | SBD Ed.2025 (**texto lido**) | Metformina não é mais 1ª linha universal — já corrigido | Baixo | Confirmar se a correção aplicada reflete fielmente a diretriz e autorizar promoção | PRONTA_PARA_VALIDACAO_HUMANA |
| `rastreamento_colo` | PENDENTE_REVISAO | MS/INCA/CONITEC Portaria 13/2025 (busca) | Mudança de paradigma DNA-HPV — parcialmente corrigido | Médio | Fluxo de citologia (ASC-US/LSIL/HSIL) ainda se aplica em algum cenário de transição? Conduta se DNA-HPV indisponível? | PENDENTE_AJUSTE |
| `vacinacao` | PENDENTE_REVISAO | MS/PNI IN 2026 (**texto lido**) | Reforço 12 meses = Men ACWY — já corrigido e confirmado | Baixo (bloco meningocócico); médio (demais blocos não relidos) | Confirmar demais blocos (BCG/Penta/VIP-VOP/Pneumo/Rotavírus/Tríplice Viral/HPV/Influenza/dT-dTpa) e autorizar promoção do bloco meningocócico | PRONTA_PARA_VALIDACAO_HUMANA (bloco meningocócico) / PENDENTE_AJUSTE (demais blocos) |
| `sifilis` | PENDENTE_REVISAO | PCDT-IST 2024 (**texto lido**) | Nenhuma — conteúdo confirmado estável | Baixo | Confirmar e autorizar promoção (conteúdo já verificado linha a linha) | PRONTA_PARA_VALIDACAO_HUMANA |
| `hiv` | PENDENTE_REVISAO | PCDT HIV Módulo I 2024 (**texto lido**) | Nenhuma no esquema 1ª linha — conteúdo confirmado estável; PEP/PrEP não relidos | Baixo (1ª linha); médio (PEP/PrEP) | Confirmar e autorizar promoção do esquema de 1ª linha; revisar PEP/PrEP separadamente | PRONTA_PARA_VALIDACAO_HUMANA (TARV 1ª linha) / PENDENTE_AJUSTE (PEP/PrEP) |
| `ictericia_neonatal` (novo) | PENDENTE_REVISAO (proposta) | SBP Manual nº 20/2023 (busca) | N/A — diretriz nova | Médio | Ler o manual completo e confirmar nomograma de Bhutani antes de liberar | PENDENTE_AJUSTE |
| `diverticulite` (novo) | PENDENTE_REVISAO (proposta) | WSES 2020 (via fonte secundária) | N/A — diretriz nova, confiança reduzida | Médio-alto | Localizar e ler o documento WSES primário; confirmar se antibiótico de rotina ainda é recomendado em quadro leve (ver R111) | PENDENTE_AJUSTE |
| `tvp_wells` (novo) | PENDENTE_REVISAO (proposta) | Escore de Wells + uso corrente (via fonte secundária) | N/A — diretriz nova | Médio | Localizar diretriz CHEST/ACCP primária; confirmar limitações em gestante/oncológico/internado | PENDENTE_AJUSTE |
| `distocia_ombro` (novo) | PENDENTE_REVISAO (proposta) | FEBRASGO Guia de Habilidades 25/03/2023 (busca) | N/A — diretriz nova | Médio | Ler o PDF completo (falha técnica de download nesta sessão); confirmar contraindicação de pressão fúndica no texto | PENDENTE_AJUSTE |
| `violencia_domestica` (novo) | PENDENTE_REVISAO (proposta) | Lei 13.931/2019 + normas correlatas (busca) | N/A — diretriz nova, causa raiz da falha de R096 | Médio | Ler o texto legal completo; confirmar prazo de notificação antes de incluir qualquer número | PENDENTE_AJUSTE |

**Campos vazios em todas as 11 (preenchimento humano):** `VALIDADO POR: ____` · `DATA DA VALIDAÇÃO: ____` · `DECISÃO: ____` · `OBSERVAÇÕES DO RESPONSÁVEL: ____`
