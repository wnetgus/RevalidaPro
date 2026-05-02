import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Login");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setPage("Dashboard");
      } else {
        setUser(null);
        setPage("Login");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setPage("Login");
  };

  return (
    <div className="app">
      {user && (
        <Sidebar
          onSelectPage={setPage}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      )}

      <div
        className="main-content"
        style={{
          marginLeft: user ? (collapsed ? "80px" : "250px") : "0",
        }}
      >
        {user && (
          <header className="header">
            <h3>
  Bem-vindo,{" "}
  {user.displayName
    ? user.displayName
    : "Dr./Dra."}
</h3>
            <button onClick={handleLogout}>Sair</button>
          </header>
        )}

        {page === "Login" && <Login setPage={setPage} />}
        {page === "Register" && <Register setPage={setPage} />}
        {page === "Dashboard" && <Dashboard />}
      </div>
    </div>
  );
}

export default App;