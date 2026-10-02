import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/navigation/Navbar";
import Login from "@/pages/Login";
import PersonalDashboard from "@/pages/PersonalDashboard";
import CorporateDashboard from "@/pages/CorporateDashboard";
import ComplianceDashboard from "@/pages/ComplianceDashboard";
import CostRunbook from "@/pages/CostRunbook";
import Notifications from "@/pages/Notifications";
import { AskAegis } from "@/components/AskAegis";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

function Shell() {
  const { user, loading } = useAuth();
  const [range, setRange] = useState("30d");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }
  if (!user) return <Login />;

  const isCompliance = user.role === "compliance";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar range={range} setRange={setRange} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="/" element={<PersonalDashboard range={range} />} />
          <Route path="/cost" element={<CostRunbook range={range} />} />
          <Route path="/alerts" element={<Notifications />} />
          <Route path="/governance" element={isCompliance ? <CorporateDashboard range={range} /> : <Navigate to="/" />} />
          <Route path="/audit" element={isCompliance ? <ComplianceDashboard /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <AskAegis />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Shell />
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
