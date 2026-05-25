import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import HeroNewestMatch from './HeroNewestMatch';

describe('HeroNewestMatch', () => {
  test('renders profile data pills and looking-for summary', () => {
    const pick = {
      profile: {
        username: 'newuser',
        firstName: 'Test',
        lastName: 'User',
        heightInches: 65,
        birthMonth: 10,
        birthYear: 1998,
        age: 27,
        religion: 'Hindu',
        caste: 'Others',
        location: 'New York',
        workExperience: [{ description: 'BA in Software', isCurrent: true }],
        educationHistory: [
          { degree: 'BS in Computer Science', institution: 'UT Dallas' },
          { degree: 'MS in Software Engineering', institution: 'Example University' },
        ],
        partnerCriteria: {
          educationLevel: "Bachelor's",
          location: 'Any Location',
        },
      },
      savedSearch: { name: 'Default' },
    };

    render(
      <MemoryRouter>
        <HeroNewestMatch
          pick={pick}
          loading={false}
          error={null}
          isEmpty={false}
          onSkip={() => {}}
          onOpenSearch={() => {}}
          favoritedUsernames={new Set()}
          onRefresh={() => {}}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("5'5\"")) .toBeInTheDocument();
    expect(screen.getByText('10/1998')).toBeInTheDocument();
    expect(screen.getByText('Hindu')).toBeInTheDocument();
    expect(screen.getByText('27yrs')).toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();

    expect(screen.getByText(/New York/i)).toBeInTheDocument();
    expect(screen.getByText(/BA in Software/i)).toBeInTheDocument();
    expect(screen.getByText(/BS in Computer Science, UT Dallas/i)).toBeInTheDocument();

    expect(screen.getByText('LOOKING FOR:')).toBeInTheDocument();
    expect(screen.getByText("Bachelor's, Any Location")).toBeInTheDocument();
  });
});
