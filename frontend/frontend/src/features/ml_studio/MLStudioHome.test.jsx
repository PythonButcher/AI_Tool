import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MLStudioHome from './MLStudioHome';

describe('ML Studio home learning explorer', () => {
  it.each([
    ['Regression', 'Regularized linear (Ridge)', 'Random forest'],
    ['Classification', 'Logistic regression', 'Random forest'],
    ['Forecasting', 'Lagged Ridge', 'Lagged random forest'],
    ['Clustering', 'K-means', 'Mini-batch K-means'],
    ['Anomaly detection', 'Isolation forest', 'Local outlier factor'],
  ])('explores %s without starting or changing an experiment', (label, first, second) => {
    const create = jest.fn();
    render(<MLStudioHome onCreate={create} />);
    const picker = screen.getByRole('group', { name: 'Explore machine learning tasks' });
    const selected = within(picker).getByRole('button', { name: new RegExp(label) });
    fireEvent.click(selected);
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getAllByRole('button').filter(button => button.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: first })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: second })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Illustration of .*; not experiment results/ })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(['scikit-learn.org', 'developers.google.com']).toContain(new URL(link.href).hostname);
      expect(link.href).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps learning usable without data and prevents creation while a draft action is pending', () => {
    const create = jest.fn();
    const { rerender } = render(<MLStudioHome canCreate={false} onCreate={create} />);
    expect(screen.getByRole('heading', { name: 'No Dataset Selected' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Experiment' }));
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Clustering/ }));
    expect(screen.getByRole('heading', { name: 'K-means' })).toBeInTheDocument();
    rerender(<MLStudioHome onCreate={create} pendingAction="deleting-exp-1" />);
    expect(screen.getByRole('button', { name: 'New Experiment' })).toBeDisabled();
    rerender(<MLStudioHome onCreate={create} pendingAction="creating" />);
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    rerender(<MLStudioHome onCreate={create} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Experiment' }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('moves keyboard focus to learning when exploring from the hero', () => {
    render(<MLStudioHome />);
    const heading = screen.getByRole('heading', { name: 'One studio. Five ways to explore.' });
    const canvas = screen.getByRole('main', { name: 'Experiment Home' });
    canvas.scrollTo = jest.fn();
    fireEvent.click(screen.getByRole('button', { name: 'Explore algorithms' }));
    expect(heading).toHaveFocus();
    expect(canvas.scrollTo).toHaveBeenCalledWith({ top: expect.any(Number) });
  });
});
