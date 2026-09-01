import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['.next/**', 'node_modules/**', 'var/**'] },
  {
    rules: {
      /*
        Le préfixe « _ » marque un paramètre volontairement inutilisé — un
        argument imposé par une interface, par exemple. TypeScript le comprend
        déjà (`noUnusedParameters` l'exempte) ; ESLint, non, et signalait donc
        comme un oubli ce qui est une intention. Les deux outils disent
        maintenant la même chose.
      */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
