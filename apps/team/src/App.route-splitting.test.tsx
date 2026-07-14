import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

describe('team route loading boundaries', () => {
  it('shows the suspense shell while a public route chunk loads, then renders that route', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading page');
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
  });

  it('keeps the not-found route available from the entry chunk', () => {
    render(
      <MemoryRouter initialEntries={['/not-a-team-route']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('404 · not found')).toBeInTheDocument();
  });
});
