import React, { useState, useEffect } from 'react';
import { Star, Smile, Plus, Heart, ThumbsUp, MessageCircle, AlertTriangle, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function QuickTags() {
  const { currentScreenshot, updateScreenshotTags } = useApp();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = [
    { id: 'red', color: 'bg-red-500', icon: Star, label: 'Important' },
    { id: 'blue', color: 'bg-blue-500', icon: Smile, label: 'Good' },
    { id: 'green', color: 'bg-green-500', icon: Plus, label: 'Add' },
    { id: 'pink', color: 'bg-pink-500', icon: Heart, label: 'Like' },
    { id: 'purple', color: 'bg-purple-500', icon: ThumbsUp, label: 'Approve' },
    { id: 'yellow', color: 'bg-yellow-500', icon: MessageCircle, label: 'Comment' },
    { id: 'orange', color: 'bg-orange-500', icon: AlertTriangle, label: 'Warning' },
    { id: 'gray', color: 'bg-gray-500', icon: Zap, label: 'Action' }
  ];

  // Sync tags with current screenshot
  useEffect(() => {
    if (currentScreenshot) {
      setSelectedTags(currentScreenshot.tags || []);
    } else {
      setSelectedTags([]);
    }
  }, [currentScreenshot]);

  const toggleTag = (tagId: string) => {
    if (!currentScreenshot) return;
    
    let newTags: string[];
    if (selectedTags.includes(tagId)) {
      newTags = selectedTags.filter(id => id !== tagId);
    } else {
      newTags = [...selectedTags, tagId];
    }
    
    setSelectedTags(newTags);
    updateScreenshotTags(currentScreenshot.id, newTags);
  };

  return (
    <div className="bg-gray-100 border-l border-r border-gray-300 h-full flex flex-col items-center py-4 gap-3" style={{ paddingLeft: '7px', paddingRight: '7px' }}>
      {tags.map((tag) => {
        const IconComponent = tag.icon;
        const isSelected = selectedTags.includes(tag.id);
        
        return (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            className={`w-8 h-8 rounded-full border-2 hover:scale-110 transition-all duration-200 flex items-center justify-center ${
              tag.color
            } ${
              isSelected 
                ? 'border-gray-800 shadow-lg ring-2 ring-gray-400' 
                : 'border-gray-400 hover:border-gray-600'
            }`}
            title={tag.label}
          >
            <IconComponent 
              className={`w-4 h-4 ${
                isSelected ? 'text-white' : 'text-white opacity-80'
              }`} 
            />
          </button>
        );
      })}
    </div>
  );
}