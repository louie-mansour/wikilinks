import { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';
import {
  SUGGESTIONS as WIKI_SUGGESTIONS,
  animateRoulette,
  resolveSearchArticles,
} from '../../data/suggestions';

const SUGGESTIONS = [
  { title: 'Albert Einstein', featured: true },
  { title: 'Quantum mechanics', featured: true },
  { title: 'Special relativity' },
  { title: 'General relativity' },
  { title: 'Niels Bohr' },
  { title: 'Max Planck' },
  { title: 'Marie Curie', featured: true },
  { title: 'Isaac Newton', featured: true },
  { title: 'Stephen Hawking' },
  { title: 'Richard Feynman' },
  { title: 'Black hole', featured: true },
  { title: 'Big Bang', featured: true },
  { title: 'DNA', featured: true },
  { title: 'Evolution', featured: true },
  { title: 'Artificial intelligence', featured: true },
  { title: 'World War II', featured: true },
  { title: 'Leonardo da Vinci', featured: true },
];

const meta = {
  title: 'WikiLinks/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'sand' },
    docs: {
      story: { height: '460px' },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: '14px 16px 0',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
  },
};

export const WithValues: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
    startValue: 'Albert Einstein',
    endValue: 'Quantum mechanics',
  },
};

export const LongInputs: Story = {
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
    startValue: 'International Union of Pure and Applied Physics',
    endValue:
      'United Nations Educational, Scientific and Cultural Organization',
  },
};

/** Mirrors app “I’m feeling lucky” flow — empty fields roulette for 1s before landing. */
export const FeelingLuckyRoulette: Story = {
  name: 'Feeling Lucky (roulette)',
  args: {
    startSuggestions: SUGGESTIONS,
    endSuggestions: SUGGESTIONS,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Leave one or both fields empty and click **Find paths**. Inputs cycle random article titles for ~1s, slowing until they land on the chosen pair.',
      },
    },
  },
  render: function FeelingLuckyRouletteStory() {
    const [startValue, setStartValue] = useState('');
    const [endValue, setEndValue] = useState('');
    const [isRouletting, setIsRouletting] = useState(false);

    const handleSearch = useCallback(async () => {
      if (isRouletting) return;

      const needsStartRandom = !startValue.trim();
      const needsEndRandom = !endValue.trim();
      const { start, end } = resolveSearchArticles(startValue, endValue);

      const rouletteTasks: Promise<void>[] = [];
      if (needsStartRandom) {
        rouletteTasks.push(animateRoulette(start, setStartValue));
      } else {
        setStartValue(start);
      }
      if (needsEndRandom) {
        rouletteTasks.push(animateRoulette(end, setEndValue));
      } else {
        setEndValue(end);
      }

      if (rouletteTasks.length > 0) {
        setIsRouletting(true);
        await Promise.all(rouletteTasks);
        setIsRouletting(false);
      }
    }, [startValue, endValue, isRouletting]);

    return (
      <Header
        startSuggestions={WIKI_SUGGESTIONS}
        endSuggestions={WIKI_SUGGESTIONS}
        startValue={startValue}
        endValue={endValue}
        onStartChange={setStartValue}
        onEndChange={setEndValue}
        onStartSelect={setStartValue}
        onEndSelect={setEndValue}
        onSearch={handleSearch}
        isSearching={isRouletting}
        searchLabel={isRouletting ? 'Picking articles…' : 'Find paths'}
      />
    );
  },
};
