import { render, screen } from '@testing-library/react';
import App from './App';

test('renders reimbursement heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /reimbursements hub/i });
  expect(heading).toBeInTheDocument();
});
