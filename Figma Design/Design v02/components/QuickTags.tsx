import React, { useState } from 'react';
import { Star, Smile, Plus, Heart, ThumbsUp, MessageCircle, AlertTriangle, Zap } from 'lucide-react';

export function QuickTags() {
  const [selectedTags, setSelectedTags] = useState<string[]>(['red']);

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

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  return (
    <div className="bg-gray-100 border-l border-r border-gray-300 w-12 h-full flex flex-col items-center py-4 gap-3">
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