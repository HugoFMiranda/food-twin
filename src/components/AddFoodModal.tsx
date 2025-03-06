'use client';

import { useState } from 'react';
import { api } from "food-twin/trpc/react";

type Portion = {
  amount: number | null;
  portionDescription: string | null;
  gramWeight: number | null;
};

type AddFoodModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (food: any) => void;
  darkMode?: boolean;
};

export default function AddFoodModal({ isOpen, onClose, onSuccess, darkMode = false }: AddFoodModalProps) {
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [isVegan, setIsVegan] = useState(false);
  const [portions, setPortions] = useState<Portion[]>([
    { amount: null, portionDescription: null, gramWeight: null }
  ]);
  const [error, setError] = useState('');

  const createFoodMutation = api.food.createFood.useMutation({
    onSuccess: (data) => {
      onSuccess?.(data);
      onClose();
      resetForm();
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const resetForm = () => {
    setFoodName('');
    setCalories(null);
    setProtein(null);
    setCarbs(null);
    setFat(null);
    setIsVegan(false);
    setPortions([{ amount: null, portionDescription: null, gramWeight: null }]);
    setError('');
  };

  const handleAddPortion = () => {
    setPortions([...portions, { amount: null, portionDescription: null, gramWeight: null }]);
  };

  const handleRemovePortion = (index: number) => {
    setPortions(portions.filter((_, i) => i !== index));
  };

  const handlePortionChange = (index: number, field: keyof Portion, value: string) => {
    setPortions(prevPortions => {
      // Create a new array to avoid mutating state
      return prevPortions.map((portion, i) => {
        // Only update the portion at the specified index
        if (i !== index) return portion;
        
        // Create a new portion object with the updated field
        if (field === 'portionDescription') {
          return {
            ...portion,
            portionDescription: value || null
          };
        } else if (field === 'amount') {
          return {
            ...portion,
            amount: value === '' ? null : parseFloat(value)
          };
        } else if (field === 'gramWeight') {
          return {
            ...portion,
            gramWeight: value === '' ? null : parseFloat(value)
          };
        }
        
        // Default case (shouldn't happen with TypeScript)
        return portion;
      });
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!foodName.trim()) {
      setError('Food name is required');
      return;
    }

    // Filter out empty portions
    const validPortions = portions.filter(
      p => p.portionDescription || p.amount || p.gramWeight
    );

    createFoodMutation.mutate({
      description: foodName,
      calories,
      protein,
      carbs,
      fat,
      isVegan,
      portions: validPortions.length > 0 ? validPortions : undefined
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors ${
        darkMode 
          ? 'bg-gray-800 text-gray-200' 
          : 'bg-white text-gray-800'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Food</h2>
          <button 
            onClick={onClose}
            className={`hover:opacity-80 transition-opacity ${
              darkMode ? 'text-gray-300' : 'text-gray-500'
            }`}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className={`mb-4 p-3 rounded-md ${
            darkMode 
              ? 'bg-red-900/20 border border-red-800 text-red-300' 
              : 'bg-red-50 text-red-700'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className={`block mb-1 font-medium ${
                darkMode ? 'text-gray-200' : ''
              }`}>
                Food Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                className={`w-full p-2 border rounded transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
                placeholder="e.g., Grilled Chicken Breast"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block mb-1 font-medium ${
                  darkMode ? 'text-gray-200' : ''
                }`}>Calories</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={calories === null ? '' : calories}
                  onChange={(e) => setCalories(e.target.value ? parseFloat(e.target.value) : null)}
                  className={`w-full p-2 border rounded transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  placeholder="kcal"
                />
              </div>
              <div>
                <label className={`block mb-1 font-medium ${
                  darkMode ? 'text-gray-200' : ''
                }`}>Protein (g)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={protein === null ? '' : protein}
                  onChange={(e) => setProtein(e.target.value ? parseFloat(e.target.value) : null)}
                  className={`w-full p-2 border rounded transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  placeholder="grams"
                />
              </div>
              <div>
                <label className={`block mb-1 font-medium ${
                  darkMode ? 'text-gray-200' : ''
                }`}>Carbs (g)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={carbs === null ? '' : carbs}
                  onChange={(e) => setCarbs(e.target.value ? parseFloat(e.target.value) : null)}
                  className={`w-full p-2 border rounded transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  placeholder="grams"
                />
              </div>
              <div>
                <label className={`block mb-1 font-medium ${
                  darkMode ? 'text-gray-200' : ''
                }`}>Fat (g)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fat === null ? '' : fat}
                  onChange={(e) => setFat(e.target.value ? parseFloat(e.target.value) : null)}
                  className={`w-full p-2 border rounded transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  placeholder="grams"
                />
              </div>
            </div>

            <div>
              <label className={`flex items-center gap-2 ${
                darkMode ? 'text-gray-200' : ''
              }`}>
                <input
                  type="checkbox"
                  checked={isVegan}
                  onChange={(e) => setIsVegan(e.target.checked)}
                  className={darkMode ? 'accent-blue-500' : ''}
                />
                Vegan
              </label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`font-medium ${
                  darkMode ? 'text-gray-200' : ''
                }`}>Portions (Optional)</label>
                <button
                  type="button"
                  onClick={handleAddPortion}
                  className={`text-sm transition-colors ${
                    darkMode 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-blue-500 hover:text-blue-700'
                  }`}
                >
                  + Add Portion
                </button>
              </div>
              
              {portions.map((portion, index) => (
                <div key={index} className={`grid grid-cols-3 gap-2 mb-2 p-2 rounded transition-colors ${
                  darkMode 
                    ? 'bg-gray-700' 
                    : 'bg-gray-50'
                }`}>
                  <div>
                    <label className={`block text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Description</label>
                    <input
                      type="text"
                      value={portion.portionDescription || ''}
                      onChange={(e) => handlePortionChange(index, 'portionDescription', e.target.value)}
                      className={`w-full p-2 border rounded transition-colors ${
                        darkMode 
                          ? 'bg-gray-600 border-gray-500 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., Cup, Slice"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={portion.amount === null ? '' : portion.amount}
                      onChange={(e) => handlePortionChange(index, 'amount', e.target.value)}
                      className={`w-full p-2 border rounded transition-colors ${
                        darkMode 
                          ? 'bg-gray-600 border-gray-500 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., 1, 0.5"
                    />
                  </div>
                  <div className="relative">
                    <label className={`block text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Weight (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={portion.gramWeight === null ? '' : portion.gramWeight}
                      onChange={(e) => handlePortionChange(index, 'gramWeight', e.target.value)}
                      className={`w-full p-2 border rounded transition-colors ${
                        darkMode 
                          ? 'bg-gray-600 border-gray-500 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                      placeholder="grams"
                    />
                    {portions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePortion(index)}
                        className={`absolute right-0 top-0 transition-colors ${
                          darkMode 
                            ? 'text-red-400 hover:text-red-300' 
                            : 'text-red-500 hover:text-red-700'
                        }`}
                        aria-label="Remove portion"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className={`text-xs italic flex items-center ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <span className={`inline-block w-3 h-3 rounded-full mr-1 ${
                  darkMode ? 'bg-blue-700 border-blue-600' : 'bg-blue-100 border-blue-300'
                } border`}></span>
                User-created foods will be marked with a blue dot
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 border rounded transition-colors ${
                    darkMode 
                      ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded transition-colors ${
                    darkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  disabled={createFoodMutation.isPending}
                >
                  {createFoodMutation.isPending ? 'Saving...' : 'Save Food'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 