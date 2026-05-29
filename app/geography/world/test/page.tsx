// Temporary smoke-test route for the WorldMap component. A sibling agent is
// building the real world-geography routes and will replace/integrate this.
'use client';

import { useState } from 'react';
import {
  WorldMap,
  defaultContinentTints,
} from '@/components/geography';

export default function WorldMapTestPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const [tinted, setTinted] = useState(true);
  const [labels, setLabels] = useState(false);

  const continentTints = tinted ? defaultContinentTints() : undefined;

  return (
    <main className="min-h-screen p-6 bg-white">
      <h1 className="text-2xl font-semibold mb-2">WorldMap — smoke test</h1>
      <p className="text-sm text-gray-600 mb-4">
        Hover any country to see its ISO-3. Click to set the click target.
      </p>

      <div className="flex gap-4 mb-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={tinted}
            onChange={(e) => setTinted(e.target.checked)}
          />
          Continent tints
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
          />
          Country labels
        </label>
        <span className="text-gray-700">
          Hover: <code>{hovered ?? '—'}</code>
        </span>
        <span className="text-gray-700">
          Click: <code>{clicked ?? '—'}</code>
        </span>
      </div>

      <div className="border border-gray-200 rounded">
        <WorldMap
          continentTints={continentTints}
          showCountryLabels={labels}
          onCountryHover={setHovered}
          onCountryClick={setClicked}
        />
      </div>
    </main>
  );
}
