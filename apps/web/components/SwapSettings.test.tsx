/**
 * Test suite for the SlippagePanel (SwapSettings component).
 *
 * Covers:
 * - Rendering all preset slippage buttons
 * - Selecting a preset activates it and clears custom input
 * - Custom input updates the active slippage value
 * - Active preset styling is applied correctly
 * - Custom value deactivates preset styling
 * - MevToggle is rendered within the panel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapSettings } from './SwapSettings';

// ─── Mock MevToggle so tests stay focused on slippage behaviour ───────────────
vi.mock('./MevToggle', () => ({
  MevToggle: () => <div data-testid="mev-toggle">MEV Toggle</div>,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSettings() {
  return render(<SwapSettings />);
}

function getPresetButton(label: string) {
  return screen.getByRole('button', { name: `${label}%` });
}

function getCustomInput() {
  return screen.getByPlaceholderText('Custom') as HTMLInputElement;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SwapSettings — slippage panel', () => {
  beforeEach(() => {
    renderSettings();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the "Swap Settings" heading', () => {
      expect(screen.getByText('Swap Settings')).toBeInTheDocument();
    });

    it('renders the "Slippage tolerance" label', () => {
      expect(screen.getByText('Slippage tolerance')).toBeInTheDocument();
    });

    it('renders all three preset buttons (0.1%, 0.5%, 1.0%)', () => {
      expect(getPresetButton('0.1')).toBeInTheDocument();
      expect(getPresetButton('0.5')).toBeInTheDocument();
      expect(getPresetButton('1.0')).toBeInTheDocument();
    });

    it('renders the custom slippage input', () => {
      expect(getCustomInput()).toBeInTheDocument();
    });

    it('custom input has correct numeric constraints', () => {
      const input = getCustomInput();
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '50');
      expect(input).toHaveAttribute('step', '0.1');
    });

    it('renders the MevToggle section', () => {
      expect(screen.getByTestId('mev-toggle')).toBeInTheDocument();
    });
  });

  // ── Default state ──────────────────────────────────────────────────────────

  describe('default state', () => {
    it('defaults to 0.5% slippage preset selected', () => {
      // The active preset has a distinct dark background class
      const activeBtn = getPresetButton('0.5');
      expect(activeBtn).toHaveClass('bg-zinc-900');
    });

    it('0.1% and 1.0% presets are not active by default', () => {
      expect(getPresetButton('0.1')).not.toHaveClass('bg-zinc-900');
      expect(getPresetButton('1.0')).not.toHaveClass('bg-zinc-900');
    });

    it('custom input is empty by default', () => {
      expect(getCustomInput().value).toBe('');
    });
  });

  // ── Preset selection ───────────────────────────────────────────────────────

  describe('preset selection', () => {
    it('clicking 0.1% activates that preset', () => {
      fireEvent.click(getPresetButton('0.1'));
      expect(getPresetButton('0.1')).toHaveClass('bg-zinc-900');
    });

    it('clicking 1.0% activates that preset', () => {
      fireEvent.click(getPresetButton('1.0'));
      expect(getPresetButton('1.0')).toHaveClass('bg-zinc-900');
    });

    it('clicking a preset deactivates the previously active preset', () => {
      fireEvent.click(getPresetButton('0.1'));
      expect(getPresetButton('0.5')).not.toHaveClass('bg-zinc-900');
    });

    it('only one preset is active at a time', () => {
      fireEvent.click(getPresetButton('1.0'));

      const activeButtons = [
        getPresetButton('0.1'),
        getPresetButton('0.5'),
        getPresetButton('1.0'),
      ].filter((btn) => btn.classList.contains('bg-zinc-900'));

      expect(activeButtons).toHaveLength(1);
    });

    it('clicking a preset clears the custom input value', async () => {
      const input = getCustomInput();
      await userEvent.type(input, '2.5');
      expect(input.value).toBe('2.5');

      fireEvent.click(getPresetButton('0.5'));
      expect(input.value).toBe('');
    });
  });

  // ── Custom input ───────────────────────────────────────────────────────────

  describe('custom input', () => {
    it('typing a custom value updates the input', async () => {
      const input = getCustomInput();
      await userEvent.type(input, '3');
      expect(input.value).toBe('3');
    });

    it('typing a custom value deactivates all preset buttons', async () => {
      const input = getCustomInput();
      await userEvent.type(input, '2');

      expect(getPresetButton('0.1')).not.toHaveClass('bg-zinc-900');
      expect(getPresetButton('0.5')).not.toHaveClass('bg-zinc-900');
      expect(getPresetButton('1.0')).not.toHaveClass('bg-zinc-900');
    });

    it('accepts decimal values', async () => {
      const input = getCustomInput();
      await userEvent.type(input, '0.3');
      expect(input.value).toBe('0.3');
    });

    it('clearing the custom input and clicking a preset re-activates that preset', async () => {
      const input = getCustomInput();
      await userEvent.type(input, '2.5');

      fireEvent.click(getPresetButton('0.1'));
      expect(input.value).toBe('');
      expect(getPresetButton('0.1')).toHaveClass('bg-zinc-900');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('all preset buttons are keyboard-focusable', () => {
      for (const label of ['0.1', '0.5', '1.0']) {
        const btn = getPresetButton(label);
        expect(btn.tagName).toBe('BUTTON');
        expect(btn).not.toHaveAttribute('disabled');
      }
    });

    it('custom input is labelled via placeholder', () => {
      expect(getCustomInput()).toHaveAttribute('placeholder', 'Custom');
    });
  });
});
