/**
 * Vocabulário controlado da plataforma RevalidaPro.
 *
 * Estrutura: matéria → temas mestres → subtemas
 *
 * Regras:
 * - Os 5 nomes de matéria devem ser idênticos a MATERIAS_VALIDAS em normalizarMateria.js
 * - tema_mestre é o agrupador primário exibido em BuscarPorTema
 * - subtema é o agrupador secundário e o campo usado nos filtros do Simulador
 * - Novos temas/subtemas podem ser adicionados aqui; a plataforma os reflete automaticamente
 */

export const TAXONOMIA_BASE = {
  "Clínica Médica": [
    {
      tema_mestre: "Cardiologia",
      subtemas: [
        "Insuficiência Cardíaca",
        "Hipertensão Arterial Sistêmica",
        "Síndrome Coronariana Aguda",
        "Fibrilação Atrial e Arritmias",
        "Tromboembolismo Pulmonar",
        "Endocardite Infecciosa",
        "Pericardite",
        "Cardiopatias Valvares",
        "Emergência Hipertensiva",
      ],
    },
    {
      tema_mestre: "Pneumologia",
      subtemas: [
        "DPOC e Exacerbação Aguda",
        "Asma e Crise Asmática",
        "Pneumonia Adquirida na Comunidade",
        "Tromboembolismo Pulmonar",
        "Insuficiência Respiratória Aguda",
        "Derrame Pleural",
        "Pneumotórax",
        "Tuberculose Pulmonar",
        "Fibrose Pulmonar",
      ],
    },
    {
      tema_mestre: "Neurologia",
      subtemas: [
        "AVC Isquêmico",
        "AVC Hemorrágico",
        "Epilepsia e Estado de Mal Epiléptico",
        "Meningite Bacteriana",
        "Encefalite",
        "Cefaleia e Enxaqueca",
        "Síndrome de Guillain-Barré",
        "Esclerose Múltipla",
        "Demências",
      ],
    },
    {
      tema_mestre: "Endocrinologia",
      subtemas: [
        "Diabetes Mellitus Tipo 2",
        "Diabetes Mellitus Tipo 1",
        "Cetoacidose Diabética",
        "Estado Hiperosmolar Hiperglicêmico",
        "Hipoglicemia",
        "Hipotireoidismo",
        "Hipertireoidismo e Doença de Graves",
        "Crise Tireotóxica",
        "Coma Mixedematoso",
        "Insuficiência Adrenal",
        "Síndrome de Cushing",
        "Obesidade e Síndrome Metabólica",
      ],
    },
    {
      tema_mestre: "Nefrologia",
      subtemas: [
        "Doença Renal Crônica",
        "Injúria Renal Aguda",
        "Glomerulonefrites",
        "Síndrome Nefrótica",
        "Síndrome Nefrítica",
        "Distúrbios do Sódio",
        "Distúrbios do Potássio",
        "Distúrbios do Equilíbrio Ácido-Base",
        "Infecção do Trato Urinário",
        "Litíase Renal",
      ],
    },
    {
      tema_mestre: "Gastroenterologia e Hepatologia",
      subtemas: [
        "Doença do Refluxo Gastroesofágico",
        "Úlcera Péptica e Gastrite",
        "Hemorragia Digestiva Alta",
        "Hemorragia Digestiva Baixa",
        "Hepatites Virais",
        "Cirrose Hepática e Complicações",
        "Pancreatite Aguda",
        "Doença Inflamatória Intestinal",
        "Síndrome do Intestino Irritável",
        "Colestase",
      ],
    },
    {
      tema_mestre: "Infectologia",
      subtemas: [
        "Sepse e Choque Séptico",
        "HIV/AIDS",
        "Tuberculose",
        "Dengue",
        "Leishmaniose",
        "Malária",
        "Leptospirose",
        "Febre Amarela",
        "Endocardite Infecciosa",
        "Infecções de Pele e Partes Moles",
        "Pneumonia por COVID-19",
      ],
    },
    {
      tema_mestre: "Hematologia",
      subtemas: [
        "Anemia Ferropriva",
        "Anemia Megaloblástica",
        "Anemia Hemolítica",
        "Anemia de Doença Crônica",
        "Trombocitopenia",
        "Coagulopatias",
        "Leucemias",
        "Linfomas",
        "Doença Falciforme",
      ],
    },
    {
      tema_mestre: "Reumatologia",
      subtemas: [
        "Artrite Reumatoide",
        "Lúpus Eritematoso Sistêmico",
        "Gota e Hiperuricemia",
        "Espondilite Anquilosante",
        "Síndrome de Sjögren",
        "Fibromialgia",
        "Artrite Psoriásica",
        "Vasculites",
      ],
    },
    {
      tema_mestre: "Emergências e Terapia Intensiva",
      subtemas: [
        "Parada Cardiorrespiratória e RCP",
        "Choque Cardiogênico",
        "Choque Hipovolêmico",
        "Intoxicações Exógenas",
        "Anafilaxia",
        "Acidente Ofídico",
        "Queimaduras",
        "Afogamento",
      ],
    },
    {
      tema_mestre: "Oncologia Clínica",
      subtemas: [
        "Câncer de Pulmão",
        "Câncer Gástrico",
        "Câncer Colorretal",
        "Câncer de Próstata",
        "Síndrome Paraneoplásica",
        "Emergências Oncológicas",
      ],
    },
  ],

  "Cirurgia": [
    {
      tema_mestre: "Abdome Agudo",
      subtemas: [
        "Apendicite Aguda",
        "Colecistite Aguda e Colelitíase",
        "Pancreatite Aguda",
        "Obstrução Intestinal",
        "Isquemia Mesentérica",
        "Perfuração de Víscera Oca",
        "Peritonite",
        "Hérnia Complicada",
      ],
    },
    {
      tema_mestre: "Trauma",
      subtemas: [
        "Politrauma e ATLS",
        "Trauma Craniencefálico",
        "Trauma Torácico",
        "Trauma Abdominal",
        "Trauma de Coluna",
        "Trauma Vascular",
        "Trauma de Face",
        "Fraturas e Lesões Ortopédicas",
      ],
    },
    {
      tema_mestre: "Cirurgia Geral Eletiva",
      subtemas: [
        "Hérnia Inguinal e Femoral",
        "Hérnia Umbilical e Epigástrica",
        "Câncer Colorretal",
        "Câncer Gástrico",
        "Câncer de Esôfago",
        "Doença Diverticular do Cólon",
        "Hemorroida e Doença Anorretal",
        "Colelitíase e Colecistectomia",
      ],
    },
    {
      tema_mestre: "Cirurgia Torácica",
      subtemas: [
        "Pneumotórax Espontâneo",
        "Hemotórax",
        "Tamponamento Cardíaco",
        "Derrame Pleural Cirúrgico",
        "Ressecção Pulmonar",
      ],
    },
    {
      tema_mestre: "Cirurgia Vascular",
      subtemas: [
        "Aneurisma de Aorta",
        "Dissecção de Aorta",
        "Doença Arterial Periférica",
        "Trombose Venosa Profunda",
        "Insuficiência Venosa Crônica",
        "Amputação",
      ],
    },
    {
      tema_mestre: "Pré e Pós-Operatório",
      subtemas: [
        "Avaliação Pré-Operatória",
        "Complicações Pós-Operatórias",
        "Infecção de Sítio Cirúrgico",
        "Deiscência e Evisceração",
        "Tromboprofilaxia Cirúrgica",
        "Nutrição Perioperatória",
      ],
    },
    {
      tema_mestre: "Emergências Cirúrgicas",
      subtemas: [
        "Choque Hemorrágico",
        "Síndrome Compartimental",
        "Necrose Isquêmica de Membro",
        "Fístulas e Estomazias de Urgência",
      ],
    },
  ],

  "Pediatria": [
    {
      tema_mestre: "Neonatologia",
      subtemas: [
        "Recém-Nascido Prematuro",
        "Icterícia Neonatal",
        "Sepse Neonatal",
        "Síndrome do Desconforto Respiratório",
        "Taquipneia Transitória do RN",
        "Hipoglicemia Neonatal",
        "Triagem Neonatal",
        "Reanimação Neonatal",
        "Infecções Congênitas (TORCHS)",
      ],
    },
    {
      tema_mestre: "Infectologia Pediátrica",
      subtemas: [
        "Pneumonia Infantil",
        "Bronquiolite Viral Aguda",
        "Meningite Bacteriana na Criança",
        "Otite Média Aguda",
        "Amigdalite e Faringoamigdalite",
        "Exantemas Virais da Infância",
        "Doenças Imunopreveníveis",
        "Diarreia Infecciosa Pediátrica",
        "ITU na Infância",
        "Dengue Pediátrica",
      ],
    },
    {
      tema_mestre: "Urgências Pediátricas",
      subtemas: [
        "Crise Asmática na Infância",
        "Convulsão Febril",
        "Estado de Mal Epiléptico",
        "Desidratação Aguda",
        "Choque na Criança",
        "Anafilaxia Pediátrica",
        "Intoxicações em Crianças",
        "Corpo Estranho nas Vias Aéreas",
        "TCE Pediátrico",
      ],
    },
    {
      tema_mestre: "Crescimento e Desenvolvimento",
      subtemas: [
        "Marcos do Desenvolvimento Neuropsicomotor",
        "Avaliação do Crescimento",
        "Desnutrição e Obesidade Infantil",
        "Calendário Vacinal",
        "Aleitamento Materno",
        "Introdução Alimentar",
        "Distúrbios do Desenvolvimento",
      ],
    },
    {
      tema_mestre: "Cardiologia Pediátrica",
      subtemas: [
        "Cardiopatias Congênitas Cianóticas",
        "Cardiopatias Congênitas Acianóticas",
        "Febre Reumática",
        "Miocardite e Pericardite",
        "Insuficiência Cardíaca na Criança",
      ],
    },
    {
      tema_mestre: "Neurologia Pediátrica",
      subtemas: [
        "Epilepsia na Infância",
        "Paralisia Cerebral",
        "Hidrocefalia",
        "Meningomielocele",
        "Síndrome de Down",
        "Distúrbios do Espectro Autista",
        "TDAH",
      ],
    },
    {
      tema_mestre: "Maus-Tratos na Infância",
      subtemas: [
        "Abuso Físico",
        "Abuso Sexual",
        "Negligência",
        "Síndrome do Bebê Sacudido",
        "Notificação Compulsória",
      ],
    },
  ],

  "Ginecologia e Obstetrícia": [
    {
      tema_mestre: "Pré-natal",
      subtemas: [
        "Pré-natal de Baixo Risco",
        "Pré-natal de Alto Risco",
        "Diabetes Gestacional",
        "Hipertensão na Gestação",
        "Infecções na Gestação",
        "Gravidez Ectópica",
        "Abortamento",
        "Doença Hemolítica Perinatal",
        "Gestação Gemelar",
      ],
    },
    {
      tema_mestre: "Urgências Obstétricas",
      subtemas: [
        "Pré-eclâmpsia e Eclâmpsia",
        "Síndrome HELLP",
        "Descolamento Prematuro de Placenta",
        "Placenta Prévia",
        "Hemorragia Pós-Parto",
        "Ruptura Uterina",
        "Embolia de Líquido Amniótico",
        "Sepse Obstétrica",
      ],
    },
    {
      tema_mestre: "Trabalho de Parto e Parto",
      subtemas: [
        "Mecanismo do Parto Normal",
        "Distócias e Parto Instrumental",
        "Cesariana — Indicações e Técnica",
        "Rotura Prematura de Membranas",
        "Trabalho de Parto Prematuro",
        "Indução do Trabalho de Parto",
        "Puerpério Normal e Patológico",
      ],
    },
    {
      tema_mestre: "Ginecologia Geral",
      subtemas: [
        "Candidíase Vulvovaginal",
        "Vaginose Bacteriana",
        "Tricomoníase",
        "Doença Inflamatória Pélvica",
        "Endometriose",
        "Mioma Uterino",
        "Síndrome dos Ovários Policísticos",
        "Distúrbios Menstruais",
        "Climatério e Menopausa",
      ],
    },
    {
      tema_mestre: "Infecções Sexualmente Transmissíveis",
      subtemas: [
        "Sífilis",
        "Gonorreia",
        "Clamídia",
        "Herpes Genital",
        "Condiloma Acuminado",
        "HIV e Gestação",
        "Sífilis Congênita",
      ],
    },
    {
      tema_mestre: "Oncologia Ginecológica",
      subtemas: [
        "Câncer de Colo Uterino",
        "Rastreamento do Câncer de Colo Uterino",
        "Câncer de Mama",
        "Rastreamento do Câncer de Mama",
        "Câncer de Ovário",
        "Câncer de Endométrio",
        "Doença Trofoblástica Gestacional",
      ],
    },
    {
      tema_mestre: "Planejamento Familiar e Contracepção",
      subtemas: [
        "Métodos Contraceptivos Hormonais",
        "Dispositivo Intrauterino",
        "Métodos de Barreira",
        "Anticoncepção de Emergência",
        "Laqueadura e Vasectomia",
        "Infertilidade do Casal",
      ],
    },
  ],

  "Preventiva": [
    {
      tema_mestre: "Epidemiologia",
      subtemas: [
        "Indicadores de Saúde",
        "Medidas de Frequência (Prevalência e Incidência)",
        "Medidas de Associação",
        "Tipos de Estudos Epidemiológicos",
        "Bioestatística Básica",
        "Vigilância Epidemiológica",
        "Inquéritos Epidemiológicos",
        "Causalidade em Epidemiologia",
      ],
    },
    {
      tema_mestre: "Atenção Primária à Saúde",
      subtemas: [
        "Estratégia Saúde da Família",
        "NASF e Equipes Multiprofissionais",
        "Acolhimento e Classificação de Risco",
        "Programas de Saúde — Hiperdia",
        "Programas de Saúde — Criança Saudável",
        "Rastreamento e Prevenção de Doenças",
        "Visita Domiciliar",
        "Saúde do Idoso na APS",
        "Saúde Mental na APS",
      ],
    },
    {
      tema_mestre: "Sistema Único de Saúde",
      subtemas: [
        "Princípios e Diretrizes do SUS",
        "Leis Orgânicas da Saúde (Lei 8080 e 8142)",
        "Redes de Atenção à Saúde",
        "Financiamento do SUS",
        "Regulação e Controle Social",
        "COAP e Regionalização",
        "Normas Operacionais e NOAS",
      ],
    },
    {
      tema_mestre: "Medicina Preventiva",
      subtemas: [
        "Níveis de Prevenção",
        "Imunizações e Calendário Vacinal",
        "Saúde Ocupacional — PCMSO e PPRA",
        "Saúde do Trabalhador",
        "Doenças Relacionadas ao Trabalho",
        "Medicina do Viajante",
        "Prevenção de DCNT",
      ],
    },
    {
      tema_mestre: "Vigilância em Saúde",
      subtemas: [
        "Doenças de Notificação Compulsória",
        "Vigilância Sanitária",
        "Controle de Vetores e Zoonoses",
        "Surtos e Epidemias",
        "Investigação de Surto",
        "Biossegurança",
      ],
    },
    {
      tema_mestre: "Saúde Mental na Atenção Básica",
      subtemas: [
        "Depressão na APS",
        "Ansiedade e Transtorno de Pânico na APS",
        "Álcool e Outras Drogas",
        "Reforma Psiquiátrica e CAPS",
        "Suicídio — Prevenção e Manejo",
        "Psicose na APS",
      ],
    },
    {
      tema_mestre: "Bioética e Legislação Médica",
      subtemas: [
        "Princípios da Bioética",
        "Consentimento Informado",
        "Sigilo Médico",
        "Eutanásia e Ortotanásia",
        "Código de Ética Médica",
        "Responsabilidade Civil Médica",
        "Morte Encefálica e Doação de Órgãos",
      ],
    },
  ],
};

/**
 * Retorna a lista de subtemas de um tema mestre em uma matéria.
 * Caso não exista, retorna array vazio.
 */
export const getSubtemas = (materia, temaMestre) => {
  const temas = TAXONOMIA_BASE[materia] || [];
  const tema = temas.find(t => t.tema_mestre === temaMestre);
  return tema ? [...tema.subtemas].sort((a, b) => a.localeCompare(b, "pt-BR")) : [];
};

/**
 * Retorna todos os temas mestres de uma matéria, ordenados alfabeticamente (pt-BR).
 */
export const getTemasMestres = (materia) =>
  (TAXONOMIA_BASE[materia] || [])
    .map(t => t.tema_mestre)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
