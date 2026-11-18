import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SideBar from '../../components/layout/SideBar';
import { resolveAnalyticsDestination } from './analyticsNavigation';

test('primary navigation exposes one Analytics destination and preserves other products', () => {
  const navigate = jest.fn(); render(<SideBar activeDestination="analytics" onDestinationSelect={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));
  expect(navigate).toHaveBeenCalledWith('analytics');
  expect(screen.queryByRole('button', { name: /Explore|Business Monitoring|Dashboards/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ML Studio' })).toBeInTheDocument();
});
test('legacy launch intents route to inner views in the same application', () => {
  expect(resolveAnalyticsDestination('explore')).toEqual({ destination: 'analytics', view: 'explore' });
  expect(resolveAnalyticsDestination('dashboards')).toEqual({ destination: 'analytics', view: 'dashboards' });
  expect(resolveAnalyticsDestination('data_model').destination).toBe('data_model');
});
