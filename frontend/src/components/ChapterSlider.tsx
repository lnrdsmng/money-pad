import React from 'react';

interface ChapterSliderProps {
  parts: any[];
  currentPartId: string;
  onPartSelect: (partId: string) => void;
}

export const ChapterSlider: React.FC<ChapterSliderProps> = ({ parts, currentPartId, onPartSelect }) => {
  if (!parts || parts.length <= 1) return null;

  const currentIndex = parts.findIndex(p => p.id === currentPartId);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2.5 sm:p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
      <div className="max-w-4xl mx-auto flex items-center space-x-2 sm:space-x-4">
        <span className="text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Ch. 1</span>
        
        <div className="flex-1 relative group">
          <input 
            type="range" 
            min={0} 
            max={parts.length - 1} 
            value={currentIndex >= 0 ? currentIndex : 0}
            onChange={(e) => {
              const idx = parseInt(e.target.value);
              if (idx !== currentIndex && parts[idx]) {
                onPartSelect(parts[idx].id);
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          
          {/* Tooltip */}
          {currentIndex >= 0 && parts[currentIndex] && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {parts[currentIndex].title}
            </div>
          )}
        </div>
        
        <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Ch. {parts.length}</span>
      </div>
    </div>
  );
};
