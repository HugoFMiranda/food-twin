'use client';

import { useState } from 'react';
import { api } from "food-twin/trpc/react";

type Filters = {
  minProteinRatio?: number;
  veganOnly?: boolean;
  maxCalories?: number;
};

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // This query will get food suggestions as you type
  const suggestionsQuery = api.food.getFoodSuggestions.useQuery(
    { searchTerm },
    { enabled: searchTerm.length > 0 }
  );

  // This query will get similar foods once a food is selected
  const searchQuery = api.food.getSimilarFoods.useQuery(
    { foodName: selectedFood, filters },
    { enabled: selectedFood.length > 0 }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedFood(''); // Clear selection when typing
              }}
              placeholder="Enter a food name..."
              className="w-full p-3 rounded-lg border border-gray-300"
            />

            {/* Suggestions dropdown */}
            {searchTerm.length > 0 && suggestionsQuery.data && (
              <div className="absolute w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                {suggestionsQuery.data.map((suggestion: string) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setSelectedFood(suggestion);
                      setSearchTerm(suggestion);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Filters
          </button>
        </form>

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Filters</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2">Minimum Protein Ratio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={filters.minProteinRatio || ''}
                    onChange={(e) => setFilters(f => ({
                      ...f,
                      minProteinRatio: e.target.value ? Number(e.target.value) : undefined
                    }))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.veganOnly || false}
                      onChange={(e) => setFilters(f => ({
                        ...f,
                        veganOnly: e.target.checked
                      }))}
                    />
                    Vegan Only
                  </label>
                </div>
                <div>
                  <label className="block mb-2">Maximum Calories</label>
                  <input
                    type="number"
                    value={filters.maxCalories || ''}
                    onChange={(e) => setFilters(f => ({
                      ...f,
                      maxCalories: e.target.value ? Number(e.target.value) : undefined
                    }))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {searchQuery.data && (
          <div className="space-y-6">
            <div className="p-4 bg-gray-100 rounded-lg">
              <h2 className="font-bold mb-2">Reference Food</h2>
              <FoodCard
                food={{
                  name: searchQuery.data.referenceFood.description,
                  calories: searchQuery.data.referenceFood.calories ?? 0,
                  protein: searchQuery.data.referenceFood.protein ?? 0,
                  carbs: searchQuery.data.referenceFood.carbs ?? 0,
                  fat: searchQuery.data.referenceFood.fat ?? 0,
                  isVegan: false,
                  portions: searchQuery.data.referenceFood.portions.map(p => ({
                    amount: p.amount,
                    measureName: p.measureName,
                    gramWeight: p.gramWeight
                  }))
                }}
              />
            </div>

            <div className="space-y-4">
              <h2 className="font-bold">Similar Foods</h2>
              {searchQuery.data.similarFoods.map((food) => (
                <FoodCard
                  key={food.id}
                  food={{
                    name: food.description,
                    calories: food.calories ?? 0,
                    protein: food.protein ?? 0,
                    carbs: food.carbs ?? 0,
                    fat: food.fat ?? 0,
                    isVegan: false,
                    portions: food.portions.map(p => ({
                      amount: p.amount,
                      measureName: p.measureName,
                      gramWeight: p.gramWeight
                    }))
                  }}
                  similarity={food.similarity}
                />
              ))}
            </div>
          </div>
        )}

        {searchQuery.isError && (
          <div className="text-red-500">
            Error: {searchQuery.error.message}
          </div>
        )}
      </div>
    </main>
  );
}

function FoodCard({ food, similarity }: {
  food: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isVegan: boolean;
    portions?: {
      amount: number | null;
      measureName: string | null;
      gramWeight: number | null;
    }[];
  };
  similarity?: number;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-start">
        <h3 className="font-bold">{food.name}</h3>
        {food.isVegan && (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
            Vegan
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4 mt-2">
        <div>
          <div className="text-sm text-gray-600">Calories</div>
          <div>{food.calories.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Protein</div>
          <div>{food.protein.toFixed(1)}g</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Carbs</div>
          <div>{food.carbs.toFixed(1)}g</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Fat</div>
          <div>{food.fat.toFixed(1)}g</div>
        </div>
      </div>
      {food.portions && food.portions.length > 0 && (
        <div className="mt-2">
          <div className="text-sm text-gray-600">Common Portions:</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {food.portions.map((portion, idx) => (
              portion.measureName && (
                <span key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {portion.measureName} ({portion.gramWeight}g)
                </span>
              )
            ))}
          </div>
        </div>
      )}
      {similarity !== undefined && (
        <div className="mt-2 text-sm text-gray-600">
          Similarity Score: {(1 / (1 + similarity)).toFixed(3)}
        </div>
      )}
    </div>
  );
} 