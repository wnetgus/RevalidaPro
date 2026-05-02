import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Importação essencial para roteamento
import App from './App.jsx';
import './index.css';

// A estrutura abaixo garante que o roteador envolva toda a aplicação,
// resolvendo o erro de contexto que estava deixando sua tela azul.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);