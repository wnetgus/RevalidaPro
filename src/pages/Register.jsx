import React, { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

const Register = ({ setPage }) => {
  const [form, setForm] = useState({
    nome: "",
    sobrenome: "",
    genero: "",
    fone: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Máscara manual telefone Brasil
  const formatPhone = (value) => {
    value = value.replace(/\D/g, "");
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    value = value.replace(/(\d{5})(\d)/, "$1-$2");
    return value.substring(0, 15);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "fone") {
      setForm({ ...form, fone: formatPhone(value) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.senha !== form.confirmarSenha) {
      return setError("As senhas não conferem!");
    }

    if (!form.genero) {
      return setError("Selecione o gênero!");
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.senha
      );

      const titulo =
        form.genero === "Masculino"
          ? "Dr."
          : form.genero === "Feminino"
          ? "Dra."
          : "";

      await updateProfile(userCredential.user, {
        displayName: `${titulo} ${form.nome} ${form.sobrenome}`,
      });

      alert("Cadastro realizado com sucesso!");
      setPage("Login");

    } catch (err) {
      setError("Erro ao cadastrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <h1>Seu CRM começa aqui.</h1>
        <p>
          Cada hora de estudo aproxima você da aprovação no Revalida.
          Cadastre-se e comece sua jornada rumo ao CRM!
        </p>
      </div>

      <div className="auth-right">
        <h2>Cadastro</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="nome"
            placeholder="Nome"
            value={form.nome}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="sobrenome"
            placeholder="Sobrenome"
            value={form.sobrenome}
            onChange={handleChange}
            required
          />

          <select
            name="genero"
            value={form.genero}
            onChange={handleChange}
            required
          >
            <option value="">Selecione o gênero</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
            <option value="Outro">Outro</option>
          </select>

          <input
            type="text"
            name="fone"
            placeholder="(99) 99999-9999"
            value={form.fone}
            onChange={handleChange}
            maxLength="15"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="E-mail"
            value={form.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="senha"
            placeholder="Senha"
            value={form.senha}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="confirmarSenha"
            placeholder="Confirmar senha"
            value={form.confirmarSenha}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>

          {error && <p className="error">{error}</p>}
        </form>

        <p className="link" onClick={() => setPage("Login")}>
          Já tem conta? Faça login
        </p>
      </div>
    </div>
  );
};

export default Register;