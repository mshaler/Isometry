/**
 * FilterPresetDropdown Component
 *
 * Dropdown for managing filter presets (save/load/delete).
 * Displays saved presets with delete action per item.
 * Prompts for name when saving current filters.
 */

import { useState } from 'react';
import { useFilters } from '@/state/FilterContext';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { Save, Trash2, Check, X } from 'lucide-react';

interface FilterPresetDropdownProps {
  onPresetLoad?: () => void; // Called after preset loads
}

export function FilterPresetDropdown({
  onPresetLoad,
}: FilterPresetDropdownProps) {
  const {
    presets,
    saveCurrentAsPreset,
    loadPreset,
    deletePreset,
    checkPresetNameExists,
  } = useFilters();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  // Handle preset selection from dropdown
  const handlePresetSelect = (presetId: string) => {
    if (presetId === '__save__') {
      // Open save dialog
      setIsSaving(true);
      setPresetName('');
      setSaveError(null);
    } else {
      // Load preset
      loadPreset(presetId);
      if (onPresetLoad) {
        onPresetLoad();
      }
    }
  };

  // Handle save preset
  const handleSavePreset = async () => {
    // Validation
    if (!presetName.trim()) {
      setSaveError('Name is required');
      return;
    }

    if (presetName.length > 50) {
      setSaveError('Name must be 50 characters or less');
      return;
    }

    // Check for duplicate name
    if (await checkPresetNameExists(presetName.trim())) {
      setShowOverwriteConfirm(true);
      return;
    }

    // Save preset
    try {
      saveCurrentAsPreset(presetName.trim());
      setIsSaving(false);
      setPresetName('');
      setSaveError(null);
    } catch {
      setSaveError('Failed to save preset');
    }
  };

  // Handle overwrite confirmation
  const handleOverwrite = () => {
    try {
      // Find existing preset and update it
      const existing = presets.find((p) => p.name === presetName.trim());
      if (existing) {
        deletePreset(existing.id);
      }
      saveCurrentAsPreset(presetName.trim());
      setIsSaving(false);
      setPresetName('');
      setSaveError(null);
      setShowOverwriteConfirm(false);
    } catch {
      setSaveError('Failed to save preset');
    }
  };

  // Handle delete preset
  const handleDeletePreset = (presetId: string) => {
    setShowDeleteConfirm(presetId);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deletePreset(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Cancel save
  const handleCancelSave = () => {
    setIsSaving(false);
    setPresetName('');
    setSaveError(null);
    setShowOverwriteConfirm(false);
  };

  // Build dropdown options
  const dropdownOptions: DropdownOption[] = [
    {
      value: '__save__',
      label: 'Save Current Filters',
      icon: <Save className="w-4 h-4" />,
    },
    ...presets.map((preset) => ({
      value: preset.id,
      label: preset.name,
    })),
  ];

  return (
    <div className="space-y-2">
      {/* Dropdown */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Filter Presets
          {presets.length > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              ({presets.length} saved)
            </span>
          )}
        </label>
      </div>

      <Dropdown
        value=""
        options={dropdownOptions}
        onSelect={handlePresetSelect}
        placeholder={
          presets.length === 0 ? 'No saved presets' : 'Select a preset...'
        }
        fullWidth
      />

      {/* Preset List with Delete Actions */}
      {presets.length > 0 && (
        <div className="mt-2 space-y-1">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              <button
                onClick={() => handlePresetSelect(preset.id)}
                className="flex-1 text-left text-sm text-gray-700 hover:text-gray-900"
              >
                {preset.name}
                <span className="text-xs text-gray-400 ml-2">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </span>
              </button>

              {showDeleteConfirm === preset.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={confirmDelete}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Confirm delete"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDeletePreset(preset.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete preset"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save Preset Dialog */}
      {isSaving && (
        <div className="mt-3 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Save Current Filters
          </h3>

          {showOverwriteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Preset "{presetName}" already exists. Overwrite it?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleOverwrite}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                >
                  Overwrite
                </button>
                <button
                  onClick={() => setShowOverwriteConfirm(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={handleCancelSave}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => {
                    setPresetName(e.target.value);
                    setSaveError(null);
                  }}
                  placeholder="Enter preset name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSavePreset();
                    } else if (e.key === 'Escape') {
                      handleCancelSave();
                    }
                  }}
                />
                {saveError && (
                  <p className="text-xs text-red-600 mt-1">{saveError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelSave}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
