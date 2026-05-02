import { createContext, useContext } from "react";

// Contexto global para os dados do usuário autenticado.
// Alimentado pelo onSnapshot em App.jsx — elimina a necessidade de
// listeners duplicados em páginas filhas (ex: Dashboard).
export const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);
