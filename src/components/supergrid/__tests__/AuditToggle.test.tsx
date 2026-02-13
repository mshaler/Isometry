/**
 * AuditToggle Tests - TDD for SuperAudit toolbar toggle
 *
 * Tests cover:
 * - Rendering with enabled/disabled state
 * - Click calls onToggle with opposite value
 * - Active state styling (blue)
 * - Inactive state styling (gray)
 * - Accessibility attributes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditToggle } from '../AuditToggle';

describe('AuditToggle', () => {
  describe('rendering', () => {
    it('should render with "Audit" label', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      expect(screen.getByText('Audit')).toBeInTheDocument();
    });

    it('should render eye icon', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('click behavior', () => {
    it('should call onToggle with true when clicking disabled button', () => {
      const onToggle = vi.fn();
      render(<AuditToggle enabled={false} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('should call onToggle with false when clicking enabled button', () => {
      const onToggle = vi.fn();
      render(<AuditToggle enabled={true} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('should only call onToggle once per click', () => {
      const onToggle = vi.fn();
      render(<AuditToggle enabled={false} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling', () => {
    it('should have blue styling when enabled', () => {
      render(<AuditToggle enabled={true} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-blue-100');
      expect(button.className).toContain('text-blue-700');
    });

    it('should have gray styling when disabled', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-100');
      expect(button.className).toContain('text-gray-600');
    });
  });

  describe('accessibility', () => {
    it('should have aria-pressed attribute', () => {
      render(<AuditToggle enabled={true} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have aria-pressed false when disabled', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have aria-label', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Toggle computed value highlighting');
    });

    it('should have title tooltip when enabled', () => {
      render(<AuditToggle enabled={true} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.title).toContain('Audit mode enabled');
    });

    it('should have title tooltip when disabled', () => {
      render(<AuditToggle enabled={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button.title).toContain('Enable audit mode');
    });
  });
});
