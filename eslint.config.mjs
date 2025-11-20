import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
    ...nextCoreWebVitals,
    {
        rules: {
            "react/no-unescaped-entities": "off",
            "@next/next/no-img-element": "off",
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/set-state-in-effect": "warn",
        },
    },
];

export default config;