// eslint.config.mjs
import tseslint from "typescript-eslint"
import globals from "globals"

export default tseslint.config(
  // Игнорируем сборку и d.ts
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "coverage/**",
      "**/*.d.ts",
    ],
  },

  // Базовый набор для TS
  ...tseslint.configs.recommended,

  // Общие настройки + правила
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // 1) Разрешаем any (иначе у тебя куча правок по API)
      "@typescript-eslint/no-explicit-any": "off",

      // 2) Неиспользуемые переменные — только предупреждение,
      // и всё, что начинается с "_" — не трогаем
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  }
)
