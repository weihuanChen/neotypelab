module.exports = {
  plugins: ["jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  ignorePatterns: [
    ".eslintrc.cjs",
    "convex/_generated",
    "convex/**/*.test.ts",
    "src/routeTree.gen.ts",
    // There are currently ESLint errors in shadcn/ui
    "components/ui",
  ],
  overrides: [
    {
      files: ["src/routes/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/only-throw-error": "off",
      },
    },
  ],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // All of these overrides ease getting into
    // TypeScript, and can be removed for stricter
    // linting down the line.

    // Only warn on unused variables, and ignore variables starting with `_`
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
    ],

    // Allow escaping the compiler
    "@typescript-eslint/ban-ts-comment": "error",

    // Allow explicit `any`s
    "@typescript-eslint/no-explicit-any": "off",

    // START: Allow implicit `any`s
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    // END: Allow implicit `any`s

    // Allow async functions without await
    // for consistency (esp. Convex `handler`s)
    "@typescript-eslint/require-await": "off",

    "@typescript-eslint/no-unnecessary-condition": "warn",
    "jsx-a11y/alt-text": "warn",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/role-has-required-aria-props": "warn",
  },
};
