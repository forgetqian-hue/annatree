import React, { useState, useEffect } from 'react';

export const UI: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-16 transition-opacity duration-[2000ms] ${visible ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* Brand Header */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left z-10">
        <h2 className="text-[#FFD700] text-xs font-['Cinzel'] font-black tracking-[0.5em] mb-2 uppercase drop-shadow-lg shadow-gold">
          The Presidential Collection
        </h2>
        <h1 className="text-white text-6xl md:text-8xl font-['Playfair_Display'] font-bold leading-[0.9] drop-shadow-2xl">
          ANNA QIAO'S<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-[#B8860B] font-['Cinzel'] block mt-2 drop-shadow-sm filter blur-[0.5px]">
            CHRISTMAS TREE
          </span>
        </h1>
      </div>

      {/* Side Decoration */}
      <div className="absolute top-1/2 right-12 transform -translate-y-1/2 hidden md:flex flex-col gap-6 items-center">
         <div className="w-[2px] h-40 bg-gradient-to-b from-transparent via-[#FFD700] to-transparent shadow-[0_0_15px_#FFD700]"></div>
         <span className="text-[#FFD700] font-['Cinzel'] text-xs vertical-rl tracking-[0.5em] font-bold drop-shadow-md" style={{ writingMode: 'vertical-rl' }}>
            EST. 2025
         </span>
         <div className="w-[2px] h-40 bg-gradient-to-b from-transparent via-[#FFD700] to-transparent shadow-[0_0_15px_#FFD700]"></div>
      </div>
      
    </div>
  );
};