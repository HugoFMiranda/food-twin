'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from "food-twin/trpc/react";
import AddFoodModal from 'food-twin/components/AddFoodModal';

type Filters = {
  minProteinRatio?: number;
  veganOnly?: boolean;
  maxCalories?: number;
};

type FoodPortion = {
  amount: number | null;
  portionDescription: string | null;
  gramWeight: number | null;
};

type ReferenceFood = {
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isVegan: boolean;
  isUserCreated: boolean;
  portions: FoodPortion[];
};

type SimilarFood = ReferenceFood & {
  id: string;
  similarity: number;
};

type SearchResult = {
  referenceFood: ReferenceFood | null;
  similarFoods: SimilarFood[];
};

type MacroRef = { protein: number; carbs: number; fat: number; calories: number };

function MacroBar({
  protein,
  carbs,
  fat,
  darkMode,
  reference,
}: {
  protein: number;
  carbs: number;
  fat: number;
  darkMode: boolean;
  reference?: MacroRef;
}) {
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const total = proteinCals + carbsCals + fatCals;

  const pPct = total > 0 ? (proteinCals / total) * 100 : 0;
  const cPct = total > 0 ? (carbsCals / total) * 100 : 0;
  const fPct = total > 0 ? (fatCals / total) * 100 : 0;

  const diff = (val: number, ref: number | undefined, unit = 'g') => {
    if (ref === undefined) return null;
    const d = val - ref;
    if (Math.abs(d) < 0.05) return null;
    return { value: d, label: `${d > 0 ? '+' : ''}${d.toFixed(1)}${unit}` };
  };

  const pDiff = diff(protein, reference?.protein);
  const cDiff = diff(carbs, reference?.carbs);
  const fDiff = diff(fat, reference?.fat);

  return (
    <div className="mt-3">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-rose-400 transition-all duration-300" style={{ width: `${pPct}%` }} />
        <div className="bg-amber-400 transition-all duration-300" style={{ width: `${cPct}%` }} />
        <div className="bg-blue-400 transition-all duration-300" style={{ width: `${fPct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
        <div>
          <div className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
            <span className="text-xs">Protein</span>
          </div>
          <div className={`flex items-baseline gap-1 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <span>{protein.toFixed(1)}g</span>
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{pPct.toFixed(0)}%</span>
            {pDiff && (
              <span className={`text-xs ${pDiff.value > 0
                ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                : (darkMode ? 'text-rose-400' : 'text-rose-600')}`}>
                {pDiff.label}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-xs">Carbs</span>
          </div>
          <div className={`flex items-baseline gap-1 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <span>{carbs.toFixed(1)}g</span>
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{cPct.toFixed(0)}%</span>
            {cDiff && (
              <span className={`text-xs ${cDiff.value > 0
                ? (darkMode ? 'text-amber-400' : 'text-amber-600')
                : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                {cDiff.label}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-xs">Fat</span>
          </div>
          <div className={`flex items-baseline gap-1 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <span>{fat.toFixed(1)}g</span>
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{fPct.toFixed(0)}%</span>
            {fDiff && (
              <span className={`text-xs ${fDiff.value > 0
                ? (darkMode ? 'text-blue-400' : 'text-blue-600')
                : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                {fDiff.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FoodCard({
  food,
  similarity,
  darkMode = false,
  reference,
}: {
  food: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isVegan: boolean;
    isUserCreated?: boolean;
    portions?: {
      amount: number | null;
      measureName: string | null;
      gramWeight: number | null;
    }[];
  };
  similarity?: number;
  darkMode?: boolean;
  reference?: MacroRef;
}) {
  const normalizedScore = similarity !== undefined ? 1 / (1 + similarity) : undefined;

  const scoreBadge = (() => {
    if (normalizedScore === undefined) return null;
    const pct = normalizedScore * 100;
    if (darkMode) {
      if (normalizedScore >= 0.9) return { bg: 'bg-emerald-900/40', text: 'text-emerald-300', label: `${pct.toFixed(1)}% match` };
      if (normalizedScore >= 0.75) return { bg: 'bg-lime-900/40', text: 'text-lime-300', label: `${pct.toFixed(1)}% match` };
      if (normalizedScore >= 0.6) return { bg: 'bg-amber-900/40', text: 'text-amber-300', label: `${pct.toFixed(1)}% match` };
      if (normalizedScore >= 0.45) return { bg: 'bg-orange-900/40', text: 'text-orange-300', label: `${pct.toFixed(1)}% match` };
      return { bg: 'bg-rose-900/40', text: 'text-rose-300', label: `${pct.toFixed(1)}% match` };
    }
    if (normalizedScore >= 0.9) return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: `${pct.toFixed(1)}% match` };
    if (normalizedScore >= 0.75) return { bg: 'bg-lime-100', text: 'text-lime-700', label: `${pct.toFixed(1)}% match` };
    if (normalizedScore >= 0.6) return { bg: 'bg-amber-100', text: 'text-amber-700', label: `${pct.toFixed(1)}% match` };
    if (normalizedScore >= 0.45) return { bg: 'bg-orange-100', text: 'text-orange-700', label: `${pct.toFixed(1)}% match` };
    return { bg: 'bg-rose-100', text: 'text-rose-700', label: `${pct.toFixed(1)}% match` };
  })();

  const calDiff = reference !== undefined ? food.calories - reference.calories : 0;

  return (
    <div className={`p-4 border rounded-xl transition-colors ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <div className="flex justify-between items-start gap-2">
        <h3 className={`font-semibold flex items-center gap-1.5 leading-snug ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {food.name}
          {food.isUserCreated && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"
              title="User-created food"
            />
          )}
        </h3>
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {food.isVegan && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
            }`}>
              Vegan
            </span>
          )}
          {scoreBadge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scoreBadge.bg} ${scoreBadge.text}`}>
              {scoreBadge.label}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {food.calories.toFixed(0)}
        </span>
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>kcal</span>
        {reference !== undefined && Math.abs(calDiff) >= 1 && (
          <span className={`text-sm font-medium ${calDiff > 0
            ? (darkMode ? 'text-rose-400' : 'text-rose-600')
            : (darkMode ? 'text-emerald-400' : 'text-emerald-600')
          }`}>
            {calDiff > 0 ? '+' : ''}{calDiff.toFixed(0)} kcal
          </span>
        )}
      </div>

      <MacroBar
        protein={food.protein}
        carbs={food.carbs}
        fat={food.fat}
        darkMode={darkMode}
        reference={reference}
      />

      {food.portions && food.portions.length > 0 && (
        <div className="mt-3">
          <div className={`text-xs mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Portions</div>
          <div className="flex flex-wrap gap-1.5">
            {food.portions.slice(0, 4).map((portion, idx) =>
              portion.measureName ? (
                <span
                  key={idx}
                  className={`text-xs px-2 py-0.5 rounded ${
                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {portion.amount ? `${portion.amount} ` : ''}
                  {portion.measureName}
                  {portion.gramWeight ? ` (${portion.gramWeight}g)` : ''}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSearchTimedOut, setIsSearchTimedOut] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('food-twin-dark-mode');
    if (saved !== null) {
      setDarkMode(saved === 'true');
    } else {
      setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('food-twin-dark-mode', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset suggestion highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [debouncedSearchTerm]);

  const suggestionsQuery = api.food.getFoodSuggestions.useQuery(
    { searchTerm: debouncedSearchTerm },
    {
      enabled: debouncedSearchTerm.length > 0,
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const searchQuery = api.food.getSimilarFoods.useQuery<SearchResult>(
    { foodName: selectedFood, filters },
    {
      enabled: selectedFood.length > 0,
      retry: 0,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      gcTime: 0,
      refetchInterval: false,
    },
  );

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | null = null;
    if (searchQuery.isLoading) {
      id = setTimeout(() => setIsSearchTimedOut(true), 8000);
    } else {
      setIsSearchTimedOut(false);
    }
    return () => { if (id) clearTimeout(id); };
  }, [searchQuery.isLoading]);

  useEffect(() => {
    if (searchQuery.error) {
      if (searchQuery.error.message.includes("minProteinRatio")) {
        setFilterError("Protein ratio must be between 0 and 1. Please adjust your filters.");
      } else {
        setFilterError(searchQuery.error.message);
      }
    } else {
      setFilterError(null);
    }
  }, [searchQuery.error]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = useCallback((suggestion: string) => {
    setSelectedFood(suggestion);
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSelectedFood(searchTerm.trim());
      setShowSuggestions(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestions = suggestionsQuery.data ?? [];
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[highlightedIndex];
      if (selected) selectSuggestion(selected);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const activeFilterCount = [
    filters.minProteinRatio !== undefined,
    filters.veganOnly === true,
    filters.maxCalories !== undefined,
  ].filter(Boolean).length;

  const isIdle = !selectedFood && !searchTerm;

  const refFood = searchQuery.data?.referenceFood ?? null;
  const similarFoods = searchQuery.data?.similarFoods ?? [];
  const referenceForCard: MacroRef | undefined = refFood
    ? {
        calories: refFood.calories ?? 0,
        protein: refFood.protein ?? 0,
        carbs: refFood.carbs ?? 0,
        fat: refFood.fat ?? 0,
      }
    : undefined;

  return (
    <main className={`min-h-screen p-4 md:p-8 flex flex-col transition-colors duration-300 ${
      darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${
            darkMode ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm border border-gray-200'
          }`}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>

      <div className={`max-w-4xl mx-auto w-full transition-all duration-500 ${isIdle ? 'flex-1 flex flex-col justify-center' : 'mt-2'}`}>
        {/* Title — visible once searching */}
        {!isIdle && (
          <h1 className={`text-2xl font-bold mb-4 animate-fade-in ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Food Twin Search
          </h1>
        )}

        {/* Hero headline — idle state */}
        {isIdle && (
          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Find Your Food Twin
            </h2>
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
              Search for a food to find nutritionally similar alternatives
            </p>
          </div>
        )}

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1" ref={searchContainerRef}>
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedFood('');
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter a food name..."
              className={`w-full p-3 pr-10 rounded-lg border shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedFood('');
                  setShowSuggestions(false);
                }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors ${
                  darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            {/* Suggestions dropdown */}
            {searchTerm.length > 0 && showSuggestions && (
              <div className={`absolute w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 animate-slide-down ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                {suggestionsQuery.isLoading ? (
                  <div className={`flex items-center justify-center p-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm">Searching...</span>
                  </div>
                ) : suggestionsQuery.data && suggestionsQuery.data.length > 0 ? (
                  suggestionsQuery.data.map((suggestion, index) => (
                    <button
                      key={`${suggestion}-${index}`}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseLeave={() => setHighlightedIndex(-1)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        highlightedIndex === index
                          ? (darkMode ? 'bg-gray-600 text-white' : 'bg-blue-50 text-blue-800')
                          : (darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-50')
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <div className={`p-4 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No matching foods found
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Search
          </button>

          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`relative px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAddFoodModalOpen(true)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm'
            }`}
            aria-label="Add custom food"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Food
          </button>
        </form>

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
            <div className={`p-6 rounded-xl max-w-md w-full shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Filters</h2>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className={`rounded-lg p-1 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className={`block mb-1.5 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Minimum Protein Ratio
                    <span className={`ml-1 font-normal text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      (protein cals ÷ total cals, 0–1)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={filters.minProteinRatio ?? ''}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : undefined;
                      setFilters(f => ({ ...f, minProteinRatio: v !== undefined ? Math.min(Math.max(v, 0), 1) : undefined }));
                    }}
                    className={`w-full p-2.5 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="e.g. 0.3 = 30% from protein"
                  />
                </div>

                <div>
                  <label className={`block mb-1.5 text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Maximum Calories
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxCalories ?? ''}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : undefined;
                      setFilters(f => ({ ...f, maxCalories: v !== undefined ? Math.max(v, 0) : undefined }));
                    }}
                    className={`w-full p-2.5 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="e.g. 500"
                  />
                </div>

                <label className={`flex items-center gap-3 cursor-pointer ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={filters.veganOnly ?? false}
                    onChange={e => setFilters(f => ({ ...f, veganOnly: e.target.checked || undefined }))}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium">Vegan only</span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setFilters({}); setIsFilterModalOpen(false); }}
                    className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterModalOpen(false)}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter error */}
        {filterError && (
          <div className={`mb-6 p-4 border rounded-xl ${
            darkMode
              ? 'bg-rose-900/20 border-rose-800 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Filter error
            </div>
            <p className="mt-1 text-sm ml-6">{filterError}</p>
            <button
              onClick={() => { setFilters({}); setFilterError(null); }}
              className={`mt-2 ml-6 text-sm underline ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Loading */}
        {searchQuery.isLoading && (
          <div className="flex flex-col justify-center items-center py-12">
            <div className={`animate-spin rounded-full h-12 w-12 border-2 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent mb-4`} />
            <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
              Finding foods similar to &ldquo;{selectedFood}&rdquo;&hellip;
            </p>
            {isSearchTimedOut && (
              <div className={`mt-4 p-4 rounded-xl border text-sm max-w-sm text-center ${
                darkMode ? 'bg-amber-900/20 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <p className="font-medium mb-2">This is taking longer than expected.</p>
                <button
                  onClick={() => searchQuery.refetch()}
                  className={`underline ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {searchQuery.isError && (
          <div className={`p-4 border rounded-xl ${
            darkMode ? 'bg-rose-900/20 border-rose-800' : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 mt-0.5 ${darkMode ? 'text-rose-400' : 'text-rose-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className={`font-semibold ${darkMode ? 'text-rose-300' : 'text-rose-800'}`}>
                  Error fetching results
                </p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-rose-400' : 'text-rose-700'}`}>
                  {searchQuery.error.message}
                </p>
                <button
                  onClick={() => searchQuery.refetch()}
                  className={`mt-3 px-4 py-1.5 text-sm rounded-lg transition-colors ${
                    darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  }`}
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Food not found */}
        {searchQuery.data && !searchQuery.data.referenceFood && (
          <div className={`p-4 border rounded-xl ${
            darkMode ? 'bg-amber-900/20 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              No food found
            </div>
            <p className="mt-1 text-sm ml-6">
              &ldquo;{selectedFood}&rdquo; wasn&apos;t found in the database.{' '}
              <button
                onClick={() => setIsAddFoodModalOpen(true)}
                className={`underline font-medium ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
              >
                Add it yourself
              </button>
              .
            </p>
          </div>
        )}

        {/* No similar foods */}
        {searchQuery.data?.referenceFood && searchQuery.data.similarFoods.length === 0 && (
          <div className={`p-4 border rounded-xl ${
            darkMode ? 'bg-amber-900/20 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <p className="font-medium">No similar foods found</p>
            <p className="text-sm mt-1">
              Try adjusting your filters or searching for a different food.
            </p>
          </div>
        )}

        {/* Results */}
        {refFood && similarFoods.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Reference food
              </div>
              <FoodCard
                food={{
                  name: refFood.description,
                  calories: refFood.calories ?? 0,
                  protein: refFood.protein ?? 0,
                  carbs: refFood.carbs ?? 0,
                  fat: refFood.fat ?? 0,
                  isVegan: refFood.isVegan ?? false,
                  isUserCreated: refFood.isUserCreated ?? false,
                  portions: refFood.portions.map(p => ({
                    amount: p.amount,
                    measureName: p.portionDescription,
                    gramWeight: p.gramWeight,
                  })),
                }}
                darkMode={darkMode}
              />
            </div>

            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Similar foods — ranked by nutritional distance
              </div>
              <div className="space-y-3">
                {similarFoods.map((food, index) => (
                  <FoodCard
                    key={`${food.id}-${index}`}
                    food={{
                      name: food.description,
                      calories: food.calories ?? 0,
                      protein: food.protein ?? 0,
                      carbs: food.carbs ?? 0,
                      fat: food.fat ?? 0,
                      isVegan: food.isVegan ?? false,
                      isUserCreated: food.isUserCreated ?? false,
                      portions: food.portions?.map(p => ({
                        amount: p.amount,
                        measureName: p.portionDescription,
                        gramWeight: p.gramWeight,
                      })),
                    }}
                    similarity={food.similarity}
                    darkMode={darkMode}
                    reference={referenceForCard}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <AddFoodModal
          isOpen={isAddFoodModalOpen}
          onClose={() => setIsAddFoodModalOpen(false)}
          darkMode={darkMode}
          onSuccess={newFood => {
            setSelectedFood(newFood.description);
            setSearchTerm(newFood.description);
          }}
        />
      </div>
    </main>
  );
}
