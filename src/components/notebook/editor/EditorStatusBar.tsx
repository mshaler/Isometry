interface EditorStatusBarProps {
  wordCount: number;
  characterCount: number;
  isSaving?: boolean;
  isDirty?: boolean;
  theme?: 'NeXTSTEP' | 'Modern';
}

/**
 * EditorStatusBar - Displays word/character count and save status
 *
 * Positioned at the bottom of the editor area.
 */
export function EditorStatusBar({
  wordCount,
  characterCount,
  isSaving = false,
  isDirty = false,
  theme = 'Modern',
}: EditorStatusBarProps) {
  return (
    <div className={`
      flex items-center justify-between px-3 py-1.5 text-xs border-t
      ${theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] border-[#707070] text-gray-700'
        : 'bg-gray-50 border-gray-200 text-gray-500'
      }
    `}>
      {/* Left: Word and character count */}
      <div className="flex items-center gap-3">
        <span>{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span>
        <span className="text-gray-400">|</span>
        <span>{characterCount.toLocaleString()} {characterCount === 1 ? 'character' : 'characters'}</span>
      </div>

      {/* Right: Save status */}
      <div className="flex items-center gap-2">
        {isSaving && (
          <span className="text-blue-500">Saving...</span>
        )}
        {!isSaving && isDirty && (
          <span className="text-amber-500">Unsaved changes</span>
        )}
        {!isSaving && !isDirty && (
          <span className="text-green-600">Saved</span>
        )}
      </div>
    </div>
  );
}
