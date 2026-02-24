import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const Login = ({ setPage }) => {
  const [form, setForm] = useState({ email: "", senha: "" });
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, form.email, form.senha);
    } catch {
      setError("E-mail ou senha incorretos!");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <h1>Foco e disciplina!</h1>
        <p>Todo esforço vale a pena. Prepare-se para o Revalida e avance em sua carreira médica!</p>
      </div>
      <div className="auth-right">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" name="email" placeholder="E-mail" value={form.email} onChange={handleChange} required />
          <input type="password" name="senha" placeholder="Senha" value={form.senha} onChange={handleChange} required />
          <button type="submit">Entrar</button>
          {error && <p className="error">{error}</p>}
        </form>
        <p className="link" onClick={() => setPage("Register")}>Não tem conta? Cadastre-se</p>
      </div>
    </div>
  );
};

export default Login;