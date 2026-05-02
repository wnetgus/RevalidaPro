import React, { useState } from 'react';
import { auth } from '../firebase'; // Verifique se o caminho do seu firebase.js está correto

const Planos = () => {
  const [loading, setLoading] = useState(false);

  const handleAssinar = async (nomePlano, precoPlano) => {
    const user = auth.currentUser;

    if (!user) {
      alert("Doutor, você precisa estar logado para assinar um plano!");
      return;
    }

    setLoading(true);

    try {
      // 🚑 CHAMADA PARA A SUA CLOUD FUNCTION
      const response = await fetch('https://createpreference-kndvekrd2q-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          planoNome: nomePlano,
          preco: precoPlano
        }),
      });

      const data = await response.json();

      if (data.init_point) {
        // 🚀 REDIRECIONA PARA O CHECKOUT DO MERCADO PAGO
        window.location.href = data.init_point;
      } else {
        throw new Error("Link de pagamento não gerado.");
      }
    } catch (error) {
      console.error("Erro na cirurgia de pagamento:", error);
      alert("Houve um erro ao gerar o pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-8">
      <h2 className="text-2xl font-bold mb-6">Escolha seu Plano Revalida Pro</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-lg border border-blue-200 w-80">
        <h3 className="text-xl font-semibold text-blue-600">Plano Mensal</h3>
        <p className="text-4xl font-bold my-4">R$ 97,00</p>
        <ul className="text-sm mb-6">
          <li>✅ Banco de questões completo</li>
          <li>✅ Simulados ilimitados</li>
          <li>✅ Suporte 24h</li>
        </ul>
        
        <button 
          onClick={() => handleAssinar('Mensal Premium', 97.00)}
          disabled={loading}
          className={`w-full py-2 rounded-md text-white font-bold ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Processando...' : 'ASSINAR AGORA'}
        </button>
      </div>
    </div>
  );
};

export default Planos;