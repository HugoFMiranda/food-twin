'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from "food-twin/trpc/react";
import AddFoodModal from 'food-twin/components/AddFoodModal';

type Filters = {
  minProteinRatio?: number;
  veganOnly?: boolean;
  maxCalories?: number;
};

// Define types for the search query result
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
  isVegan?: boolean;
  isUserCreated?: boolean;
  portions: FoodPortion[];
};

type SimilarFood = {
  id: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isVegan?: boolean;
  isUserCreated?: boolean;
  similarity: number;
  portions: FoodPortion[];
};

type SearchResult = {
  referenceFood: ReferenceFood | null;
  similarFoods: SimilarFood[];
};

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Check for user's preferred color scheme on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(isDarkMode);
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const suggestionsQuery = api.food.getFoodSuggestions.useQuery(
    { searchTerm: debouncedSearchTerm },
    {
      enabled: debouncedSearchTerm.length > 0,
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    }
  );

  const searchQuery = api.food.getSimilarFoods.useQuery<SearchResult>(
    { foodName: selectedFood, filters },
    {
      enabled: selectedFood.length > 0,
      retry: 0, // Don't retry on failure to prevent infinite loading
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      gcTime: 0, // Don't keep the data in cache if not needed
      refetchInterval: false,
    }
  );

  // Add a timeout for the loading state
  const [isSearchTimedOut, setIsSearchTimedOut] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (searchQuery.isLoading) {
      // Set a timeout to show a message if the search takes too long
      timeoutId = setTimeout(() => {
        setIsSearchTimedOut(true);
      }, 8000); // 8 seconds
    } else {
      setIsSearchTimedOut(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [searchQuery.isLoading]);

  useEffect(() => {
    if (searchQuery.error) {
      console.error("Error fetching similar foods:", searchQuery.error);
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSelectedFood(searchTerm);
      setShowSuggestions(false);
    }
  };

  return (
    <main className={`min-h-screen p-4 md:p-8 flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-700'}`}
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

      <div className={`max-w-4xl mx-auto w-full transition-all duration-500 ease-smooth ${!selectedFood && !searchTerm ? 'flex-1 flex flex-col justify-center' : 'mt-4'}`}>
        <div className={`transition-all duration-300 ease-smooth ${!selectedFood && !searchTerm ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 mb-4'}`}>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Food Search</h1>
        </div>

        {/* Display a welcome message when no search is active */}
        <div className={`text-center mb-8 transition-all duration-300 ease-smooth ${!selectedFood && !searchTerm ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
          <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Find Your Food Twin</h2>
          <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Search for a food to find nutritionally similar alternatives</p>
        </div>

        <form
          onSubmit={handleSearch}
          className={`flex gap-2 mb-6 transition-all duration-500 ease-smooth ${!selectedFood && !searchTerm ? 'transform scale-105' : 'transform scale-100'}`}
        >
          <div className="relative flex-1" ref={searchContainerRef}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedFood(''); // Clear selection when typing
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter a food name..."
              className={`w-full p-3 rounded-lg border shadow-sm transition-colors ${darkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                } focus:ring-1 focus:ring-blue-500`}
              autoFocus
            />

            {/* Suggestions dropdown with loading indicator */}
            {searchTerm.length > 0 && showSuggestions && (
              <div className={`absolute w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto z-10 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                {suggestionsQuery.isLoading ? (
                  <div className={`flex items-center justify-center p-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading suggestions...
                  </div>
                ) : suggestionsQuery.data && suggestionsQuery.data.length > 0 ? (
                  suggestionsQuery.data.map((suggestion: string, index: number) => (
                    <button
                      key={`${suggestion}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedFood(suggestion);
                        setSearchTerm(suggestion);
                        setShowSuggestions(false);
                      }}
                      className={`w-full text-left px-4 py-2 ${darkMode
                          ? 'hover:bg-gray-700 text-gray-200'
                          : 'hover:bg-gray-100 text-gray-800'
                        }`}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : searchTerm.length > 0 ? (
                  <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No matching foods found
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${darkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Search
          </button>
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            Filters
          </button>
          <button
            type="button"
            onClick={() => setIsAddFoodModalOpen(true)}
            className={`px-4 py-2 rounded-lg flex items-center justify-center transition-colors ${darkMode
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            aria-label="Add Food"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </form>

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
            <div className={`p-6 rounded-lg max-w-md w-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Filters</h2>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className={`${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Minimum Protein Ratio (0-1)
                    <span className={`text-xs ml-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Protein calories / Total calories</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={filters.minProteinRatio || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      // Ensure value is between 0 and 1
                      const validValue = value !== undefined ? Math.min(Math.max(value, 0), 1) : undefined;
                      setFilters(f => ({
                        ...f,
                        minProteinRatio: validValue
                      }));
                    }}
                    className={`w-full p-2 border rounded transition-colors ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    placeholder="Enter a value between 0 and 1"
                  />
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Example: 0.3 means 30% of calories from protein</p>
                </div>
                <div>
                  <label className={`flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <input
                      type="checkbox"
                      checked={filters.veganOnly || false}
                      onChange={(e) => setFilters(f => ({
                        ...f,
                        veganOnly: e.target.checked
                      }))}
                      className={darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                    />
                    Vegan Only
                  </label>
                </div>
                <div>
                  <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Maximum Calories</label>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxCalories || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      // Ensure value is positive
                      const validValue = value !== undefined ? Math.max(value, 0) : undefined;
                      setFilters(f => ({
                        ...f,
                        maxCalories: validValue
                      }));
                    }}
                    className={`w-full p-2 border rounded transition-colors ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    placeholder="Enter maximum calories"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({});
                      setIsFilterModalOpen(false);
                    }}
                    className={`px-4 py-2 border rounded-lg transition-colors ${darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterModalOpen(false)}
                    className={`px-4 py-2 rounded-lg transition-colors ${darkMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display error message if there's a filter error */}
        {filterError && (
          <div className={`mb-6 p-4 border rounded-lg ${darkMode
              ? 'bg-red-900/20 border-red-800 text-red-300'
              : 'bg-red-50 border-red-200 text-red-700'
            }`}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Filter Error:</span>
            </div>
            <p className="mt-1 ml-7">{filterError}</p>
            <button
              onClick={() => {
                setFilters({});
                setFilterError(null);
              }}
              className={`mt-2 ml-7 text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                }`}
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Results */}
        {searchQuery.isLoading && (
          <div className="flex flex-col justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Searching for foods similar to "{selectedFood}"...</p>
            <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>This may take a moment</p>
            
            {isSearchTimedOut && (
              <div className={`mt-4 p-3 rounded-md ${
                darkMode 
                  ? 'bg-yellow-900/20 border border-yellow-800 text-yellow-300' 
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              }`}>
                <p>The search is taking longer than expected. You can:</p>
                <ul className="list-disc ml-5 mt-2">
                  <li>Wait a bit longer</li>
                  <li>
                    <button 
                      onClick={() => searchQuery.refetch()} 
                      className={`font-medium underline ${
                        darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                      }`}
                    >
                      Try again
                    </button>
                  </li>
                  <li>Try a different search term</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {searchQuery.data && !searchQuery.data.referenceFood && (
          <div className={`p-4 border rounded-lg ${
            darkMode 
              ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' 
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Food Not Found</span>
            </div>
            <p className="mt-1 ml-7">
              No food matching "{selectedFood}" was found in our database. 
              Try a different search term or <button 
                onClick={() => setIsAddFoodModalOpen(true)}
                className={`font-medium underline ${
                  darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                add this food
              </button> to the database.
            </p>
          </div>
        )}

        {searchQuery.data && searchQuery.data.referenceFood && searchQuery.data.similarFoods.length === 0 && (
          <div className={`p-4 border rounded-lg ${
            darkMode 
              ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' 
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">No Similar Foods</span>
            </div>
            <p className="mt-1 ml-7">
              No similar foods found for "{selectedFood}". Try adjusting your filters or searching for a different food.
            </p>
          </div>
        )}

        {searchQuery.data && searchQuery.data.referenceFood && searchQuery.data.similarFoods.length > 0 && (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <h2 className={`font-bold mb-2 ${darkMode ? 'text-gray-200' : ''}`}>Reference Food</h2>
              <FoodCard
                food={{
                  name: searchQuery.data.referenceFood.description,
                  calories: searchQuery.data.referenceFood.calories ?? 0,
                  protein: searchQuery.data.referenceFood.protein ?? 0,
                  carbs: searchQuery.data.referenceFood.carbs ?? 0,
                  fat: searchQuery.data.referenceFood.fat ?? 0,
                  isVegan: 'isVegan' in searchQuery.data.referenceFood ? !!searchQuery.data.referenceFood.isVegan : false,
                  isUserCreated: 'isUserCreated' in searchQuery.data.referenceFood ? !!searchQuery.data.referenceFood.isUserCreated : false,
                  portions: searchQuery.data.referenceFood.portions.map((p) => ({
                    amount: p.amount,
                    measureName: p.portionDescription,
                    gramWeight: p.gramWeight
                  }))
                }}
                darkMode={darkMode}
              />
            </div>

            <div className="space-y-4">
              <h2 className={`font-bold ${darkMode ? 'text-gray-200' : ''}`}>Similar Foods</h2>
              {searchQuery.data.similarFoods.map((food, index) => {
                const isUserCreated = 'isUserCreated' in food ? !!food.isUserCreated : false;

                return (
                  <FoodCard
                    key={`${food.id}-${index}`}
                    food={{
                      name: food.description,
                      calories: food.calories ?? 0,
                      protein: food.protein ?? 0,
                      carbs: food.carbs ?? 0,
                      fat: food.fat ?? 0,
                      isVegan: 'isVegan' in food ? !!food.isVegan : false,
                      isUserCreated,
                      portions: food.portions?.map((p) => ({
                        amount: p.amount,
                        measureName: p.portionDescription,
                        gramWeight: p.gramWeight
                      }))
                    }}
                    similarity={food.similarity}
                    darkMode={darkMode}
                  />
                );
              })}
            </div>
          </div>
        )}

        {searchQuery.isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-800">Error fetching similar foods</h3>
                <p className="text-red-700 mt-1">{searchQuery.error.message}</p>
                {searchQuery.error.data?.zodError && (
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(searchQuery.error.data.zodError, null, 2)}
                  </pre>
                )}
                <button
                  onClick={() => searchQuery.refetch()}
                  className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Food Modal */}
        <AddFoodModal
          isOpen={isAddFoodModalOpen}
          onClose={() => setIsAddFoodModalOpen(false)}
          darkMode={darkMode}
          onSuccess={(newFood) => {
            // Set the newly created food as the selected food
            setSelectedFood(newFood.description);
            setSearchTerm(newFood.description);
          }}
        />
      </div>
    </main>
  );
}

function FoodCard({ food, similarity, darkMode = false }: {
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
}) {
  // Calculate normalized similarity score (0-1 range, higher is better)
  const normalizedScore = similarity !== undefined ? 1 / (1 + similarity) : undefined;

  // Determine color based on similarity score
  const getSimilarityColor = (score: number | undefined) => {
    if (score === undefined) return darkMode ? "text-gray-400" : "text-gray-600";
    if (score >= 0.9) return darkMode ? "text-green-400 font-semibold" : "text-green-600 font-semibold";
    if (score >= 0.8) return darkMode ? "text-green-400" : "text-green-500";
    if (score >= 0.7) return darkMode ? "text-yellow-400" : "text-yellow-600";
    if (score >= 0.6) return darkMode ? "text-yellow-300" : "text-yellow-500";
    if (score >= 0.5) return darkMode ? "text-orange-400" : "text-orange-500";
    return darkMode ? "text-red-400" : "text-red-500";
  };

  // Get background color for similarity badge
  const getSimilarityBgColor = (score: number | undefined) => {
    if (score === undefined) return darkMode ? "bg-gray-700" : "bg-gray-100";
    if (score >= 0.9) return darkMode ? "bg-green-900/30" : "bg-green-100";
    if (score >= 0.8) return darkMode ? "bg-green-900/20" : "bg-green-50";
    if (score >= 0.7) return darkMode ? "bg-yellow-900/30" : "bg-yellow-100";
    if (score >= 0.6) return darkMode ? "bg-yellow-900/20" : "bg-yellow-50";
    if (score >= 0.5) return darkMode ? "bg-orange-900/20" : "bg-orange-50";
    return darkMode ? "bg-red-900/20" : "bg-red-50";
  };

  return (
    <div className={`p-4 border rounded-lg transition-colors ${darkMode
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
      }`}>
      <div className="flex justify-between items-start">
        <h3 className={`font-bold flex items-center ${darkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
          {food.name}
          {food.isUserCreated && (
            <span className={`inline-block w-3 h-3 rounded-full ml-2 ${darkMode
                ? 'bg-blue-700 border-blue-600'
                : 'bg-blue-100 border-blue-300'
              } border`}
              title="User-created food"></span>
          )}
        </h3>
        <div className="flex gap-2">
          {food.isVegan && (
            <span className={`text-xs px-2 py-1 rounded ${darkMode
                ? 'bg-green-900/30 text-green-300'
                : 'bg-green-100 text-green-800'
              }`}>
              Vegan
            </span>
          )}
          {similarity !== undefined && (
            <span className={`text-xs px-2 py-1 rounded ${getSimilarityBgColor(normalizedScore)} ${darkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
              {(normalizedScore! * 100).toFixed(1)}% match
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-2">
        <div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Calories</div>
          <div className={darkMode ? 'text-gray-200' : ''}>
            {food.calories.toFixed(1)}
          </div>
        </div>
        <div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Protein</div>
          <div className={darkMode ? 'text-gray-200' : ''}>
            {food.protein.toFixed(1)}g
          </div>
        </div>
        <div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Carbs</div>
          <div className={darkMode ? 'text-gray-200' : ''}>
            {food.carbs.toFixed(1)}g
          </div>
        </div>
        <div>
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fat</div>
          <div className={darkMode ? 'text-gray-200' : ''}>
            {food.fat.toFixed(1)}g
          </div>
        </div>
      </div>
      {food.portions && food.portions.length > 0 && (
        <div className="mt-2">
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Common Portions:</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {food.portions.map((portion, idx) => (
              portion.measureName && (
                <span key={idx} className={`text-sm px-2 py-1 rounded ${darkMode
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-gray-100 text-gray-800'
                  }`}>
                  {portion.measureName} ({portion.gramWeight}g)
                </span>
              )
            ))}
          </div>
        </div>
      )}
      {similarity !== undefined && (
        <div className="mt-2 text-sm">
          <span className={getSimilarityColor(normalizedScore)}>
            Similarity Score: {normalizedScore!.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  );
} 