import React from 'react';
import { Experience } from './components/Experience';
import { UI } from './components/UI';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-screen bg-[#01140e] overflow-hidden">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Experience />
      </div>

      {/* UI Overlay Layer */}
      <UI />
    </div>
  );
};

export default App;