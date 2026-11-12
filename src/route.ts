export type TextRoute =
  | { kind: 'pages' }
  | { kind: 'local20' }
  | { kind: 'reserved30' }
  | { kind: 'hint' };

export function classify(content: string): TextRoute {
  const value = content.trim();
  if (value.startsWith('10')) return { kind: 'pages' };
  if (value.startsWith('20')) return { kind: 'local20' };
  if (value.startsWith('30')) return { kind: 'reserved30' };
  return { kind: 'hint' };
}
