'use client';

import { GAMES, RULESETS } from '@/lib/wow';

// "Game" + "Ruleset" (WoW: Forever) or "Realm" (Classic / Retail) for the character forms.
// value: { game, realm }  onChange(patch)
export default function GameRealmFields({ value, onChange, idPrefix = '' }) {
  const game = value.game ?? 'forever';
  const forever = game === 'forever';
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}game`}>Game</label>
        <select
          id={`${idPrefix}game`}
          value={game}
          onChange={(e) => {
            const g = e.target.value;
            // Switching game: a Forever ruleset isn't a Classic/Retail realm and the other way round
            onChange({ game: g, realm: g === 'forever' ? 'Normal' : (RULESETS.includes(value.realm) ? '' : value.realm) });
          }}
        >
          {Object.entries(GAMES).map(([id, g]) => <option key={id} value={id}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}realm`}>{forever ? 'Ruleset' : 'Realm'}</label>
        {forever ? (
          <select id={`${idPrefix}realm`} value={RULESETS.includes(value.realm) ? value.realm : 'Normal'} onChange={(e) => onChange({ realm: e.target.value })}>
            {RULESETS.map((r) => <option key={r}>{r}</option>)}
          </select>
        ) : (
          <input
            id={`${idPrefix}realm`}
            value={value.realm ?? ''}
            onChange={(e) => onChange({ realm: e.target.value })}
            placeholder={game === 'retail' ? 'e.g. Silvermoon' : 'e.g. Pyrewood Village'}
            required
          />
        )}
      </div>
    </>
  );
}
