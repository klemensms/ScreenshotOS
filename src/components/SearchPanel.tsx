import React, { useState, useCallback, useEffect } from 'react';
import { Search, Calendar, Tag, Filter, X } from 'lucide-react';

interface SearchFilters {
  query: string;
  tags: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sortBy: 'date' | 'relevance';
  sortOrder: 'asc' | 'desc';
}

interface SearchPanelProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  availableTags: string[];
  isSearching: boolean;
}

export function SearchPanel({ onSearch, onClear, availableTags, isSearching }: SearchPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    tags: [],
    dateRange: { start: null, end: null },
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.query.trim() || filters.tags.length > 0 || filters.dateRange.start || filters.dateRange.end) {
        onSearch(filters);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [filters, onSearch]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, query: e.target.value }));
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  }, []);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value ? new Date(value) : null
      }
    }));
  }, []);

  const handleSortChange = useCallback((sortBy: 'date' | 'relevance', sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sortBy, sortOrder }));
  }, []);

  const handleClear = useCallback(() => {
    setFilters({
      query: '',
      tags: [],
      dateRange: { start: null, end: null },
      sortBy: 'date',
      sortOrder: 'desc'
    });
    setIsExpanded(false);
    onClear();
  }, [onClear]);

  const hasActiveFilters = filters.query.trim() || filters.tags.length > 0 || filters.dateRange.start || filters.dateRange.end;

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Main Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={isSearching ? "Searching..." : "Search screenshots, tags, notes..."}
            value={filters.query}
            onChange={handleQueryChange}
            disabled={isSearching}
            className="w-full pl-10 pr-20 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          
          {/* Search Controls */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded ${isExpanded ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Advanced filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {hasActiveFilters && !isExpanded && (
          <div className="mt-2 flex flex-wrap gap-1">
            {filters.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            
            {(filters.dateRange.start || filters.dateRange.end) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                <Calendar className="w-3 h-3" />
                Date filter
              </span>
            )}
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Tags
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateRange.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sort Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => handleSortChange(e.target.value as 'date' | 'relevance', filters.sortOrder)}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="relevance">Relevance</option>
              </select>
              
              <select
                value={filters.sortOrder}
                onChange={(e) => handleSortChange(filters.sortBy, e.target.value as 'asc' | 'desc')}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}