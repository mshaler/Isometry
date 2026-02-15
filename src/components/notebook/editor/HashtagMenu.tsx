/**
 * HashtagMenu - Dropdown menu for hashtag autocomplete
 *
 * Phase 97-02: Shows tag suggestions when typing #
 */

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface HashtagMenuProps {
  items: string[];
  command: (item: string) => void;
}

export interface HashtagMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const HashtagMenu = forwardRef<HashtagMenuRef, HashtagMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length);
    }, [items.length]);

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex);
    }, [selectItem, selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (props.event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (props.event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="hashtag-menu hashtag-menu--empty">
          <div className="hashtag-menu__item hashtag-menu__item--empty">
            No tags found
          </div>
        </div>
      );
    }

    return (
      <div className="hashtag-menu">
        {items.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`hashtag-menu__item ${
              index === selectedIndex ? 'hashtag-menu__item--selected' : ''
            }`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="hashtag-menu__tag">#{item}</span>
          </button>
        ))}
      </div>
    );
  }
);

HashtagMenu.displayName = 'HashtagMenu';
