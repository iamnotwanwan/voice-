/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Controller from './components/Controller';
import Overlay from './components/Overlay';

function Home() {
  return (
    <div className="min-h-screen bg-bg text-white flex flex-col items-center justify-center space-y-8 font-sans p-6">
      <div className="glass-panel p-12 flex flex-col items-center max-w-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-blue-500 rounded-full flex items-center justify-center font-bold text-3xl">E</div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">合奏 Ensemble <span className="opacity-50 text-2xl">AI Host</span></h1>
          <p className="text-sm text-white/50 mt-2 uppercase tracking-widest">Control Center V2.0</p>
        </div>
        <div className="flex gap-4 mt-8">
          <Link 
            to="/controller" 
            className="px-6 py-3 bg-white/10 text-white font-semibold rounded-full hover:bg-primary/80 transition-colors border border-white/10 hover:border-primary"
          >
            Open Controller
          </Link>
          <Link 
            to="/overlay" 
            className="px-6 py-3 border border-white/20 font-semibold rounded-full hover:bg-white/10 transition-colors"
          >
            Open Overlay
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isOverlay = location.pathname === "/overlay" || params.get("mode") === "overlay";

  useEffect(() => {
    if (isOverlay) {
      document.documentElement.classList.add("overlay-mode");
      document.body.classList.add("overlay-mode");
    } else {
      document.documentElement.classList.remove("overlay-mode");
      document.body.classList.remove("overlay-mode");
    }

    return () => {
      document.documentElement.classList.remove("overlay-mode");
      document.body.classList.remove("overlay-mode");
    };
  }, [isOverlay]);

  if (isOverlay) {
    return <Overlay />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/controller" element={<Controller />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
