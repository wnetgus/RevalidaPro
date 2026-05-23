/**
 * normalizarMateria.js
 *
 * Mapeia valores fragmentados/variantes do campo `materia` para uma das
 * cinco matérias canônicas do Revalida. Usado APENAS para exibição (UI).
 * A lógica de filtro usa `pertenceAMateria()` que compara por conjunto,
 * sem depender de normalização como chave.
 */

export const MATERIAS_VALIDAS = [
  "Clínica Médica",
  "Cirurgia",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Preventiva",
];

// Variantes → canônico (todas em lowercase sem acento para comparação segura)
const ALIASES = {
  "clinica medica":            "Clínica Médica",
  "clinica":                   "Clínica Médica",
  "cm":                        "Clínica Médica",

  "cirurgia":                  "Cirurgia",
  "cir":                       "Cirurgia",

  "pediatria":                 "Pediatria",
  "ped":                       "Pediatria",
  "neonatologia":              "Pediatria",

  "ginecologia e obstetricia": "Ginecologia e Obstetrícia",
  "ginecologia":               "Ginecologia e Obstetrícia",
  "obstetricia":               "Ginecologia e Obstetrícia",
  "gineco":                    "Ginecologia e Obstetrícia",
  "go":                        "Ginecologia e Obstetrícia",
  "g&o":                       "Ginecologia e Obstetrícia",

  "preventiva":                "Preventiva",
  "medicina preventiva":       "Preventiva",
  "saude publica":             "Preventiva",
  "epidemiologia":             "Preventiva",
  "sus":                       "Preventiva",
};

/** Remove acentos de forma segura sem regex com chars Unicode literais */
function semAcento(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Retorna a matéria canônica para um valor bruto.
 * Usado para exibição no dropdown — não deve ser usado como chave de filtro.
 *
 * @param {string} raw  — valor bruto do campo `materia` no Firestore
 * @returns {string|null} matéria canônica, ou null se irreconhecível
 */
export function normalizarMateria(raw) {
  if (!raw || typeof raw !== "string") return null;

  const v = raw.trim();
  if (!v) return null;

  // 1. Já é matéria válida (match exato)
  if (MATERIAS_VALIDAS.includes(v)) return v;

  const key = semAcento(v);

  // 2. Lookup direto na tabela de aliases
  if (ALIASES[key]) return ALIASES[key];

  // 3. Valor combinado "X / Y" — tenta a primeira parte reconhecível
  if (v.includes("/")) {
    for (const parte of v.split("/").map(p => p.trim())) {
      const norm = normalizarMateria(parte);
      if (norm) return norm;
    }
  }

  // 4. Busca por substring — verifica se o valor contém um alias conhecido
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (key.includes(alias)) return canonical;
  }

  // 5. Sem correspondência — retorna null (valor será ignorado nos filtros estritos)
  return null;
}

/**
 * Retorna a matéria canônica SOMENTE se for uma das 5 válidas.
 * Seguro para uso em dropdowns onde só devem aparecer as matérias oficiais.
 */
export function normalizarMateriaEstrita(raw) {
  const norm = normalizarMateria(raw);
  return norm && MATERIAS_VALIDAS.includes(norm) ? norm : null;
}

/**
 * Verifica se um valor bruto de matéria pertence à matéria canônica dada.
 * Use esta função nos FILTROS (em vez de normalizarMateria) para não
 * misturar normalização de exibição com lógica de filtragem.
 *
 * Exemplo:
 *   pertenceAMateria("Clínica Médica / Preventiva", "Clínica Médica") → true
 *   pertenceAMateria("Clínica Médica", "Clínica Médica") → true
 *   pertenceAMateria("Pediatria", "Cirurgia") → false
 */
export function pertenceAMateria(rawMateria, materiaCanonica) {
  if (!materiaCanonica) return true;
  // Match exato primeiro (mais rapido, cobre 99% dos casos)
  if (rawMateria === materiaCanonica) return true;
  // Fallback: normalizar e comparar
  return normalizarMateria(rawMateria) === materiaCanonica;
}
